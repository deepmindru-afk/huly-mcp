import type { AccountUuid as HulyAccountUuid, DocumentUpdate, Role, Space, SpaceType } from "@hcengineering/core"
import { Effect } from "effect"

import type {
  SetSpaceOwnersParams,
  SetSpaceOwnersResult,
  SetSpaceRoleMembersParams,
  SpaceMemberMutationParams,
  SpaceMemberMutationResult,
  SpaceRoleMemberMutationParams,
  SpaceRoleMembersResult,
  UpdateSpaceParams,
  UpdateSpaceResult
} from "../../domain/schemas.js"
import { DEFAULT_SPACE_OWNER_ENSURE_MEMBERS, UPDATE_SPACE_FIELDS } from "../../domain/schemas.js"
import { AccountUuid, NonEmptyString, RoleId, SpaceId, SpaceTypeId } from "../../domain/schemas/shared.js"
import { HulyClient, type HulyClientError } from "../client.js"
import { SpaceNotTypedError, SpaceRoleIdentifierAmbiguousError, SpaceRoleNotFoundError } from "../errors-spaces.js"
import { core } from "../huly-plugins.js"
import { clearTextAsEmptyString } from "./clear-field-updates.js"
import { hulyQuery } from "./query-helpers.js"
import { toAccountUuid, toClassRef, toMixinRef, toRef } from "./sdk-boundary.js"
import {
  arraysEqual,
  findSpace,
  type GenericSpace,
  mergeUniqueSortedAccountUuids,
  removeAccountUuids,
  resolveMembers,
  sortStrings,
  type SpaceMemberMutationError,
  updateSpaceDoc,
  type UpdateSpaceError
} from "./spaces-shared.js"
import { type DirectUpdateEntry, mergeUpdateEntries, requireUpdateFields } from "./update-guards.js"

type SpaceRoleAssignmentsMixin = GenericSpace & Readonly<Record<string, ReadonlyArray<HulyAccountUuid> | undefined>>

type SpaceRoleMemberMutationError =
  | SpaceMemberMutationError
  | SpaceNotTypedError
  | SpaceRoleIdentifierAmbiguousError
  | SpaceRoleNotFoundError

const roleClass = core.class.Role
const spaceTypeClass = core.class.SpaceType

const requireTypedSpaceType = (space: GenericSpace): Effect.Effect<SpaceTypeId, SpaceNotTypedError> =>
  Effect.gen(function*() {
    if (space.type === undefined) {
      return yield* new SpaceNotTypedError({
        id: SpaceId.make(space._id),
        name: NonEmptyString.make(space.name)
      })
    }
    return SpaceTypeId.make(space.type)
  })

const findSpaceType = (
  client: HulyClient["Type"],
  spaceType: SpaceTypeId
): Effect.Effect<SpaceType, HulyClientError | SpaceRoleNotFoundError> =>
  Effect.gen(function*() {
    const result = yield* client.findOne<SpaceType>(
      spaceTypeClass,
      hulyQuery<SpaceType>({ _id: toRef<SpaceType>(spaceType) })
    )

    if (result === undefined) {
      return yield* new SpaceRoleNotFoundError({
        identifier: NonEmptyString.make("SpaceType roles"),
        spaceType
      })
    }
    return result
  })

const listSpaceTypeRoles = (
  client: HulyClient["Type"],
  spaceType: SpaceTypeId
): Effect.Effect<ReadonlyArray<Role>, HulyClientError> =>
  client.findAll<Role>(
    roleClass,
    hulyQuery<Role>({
      attachedTo: toRef<SpaceType>(spaceType)
    }),
    { limit: 100 }
  )

const resolveSpaceRole = (
  spaceType: SpaceTypeId,
  roles: ReadonlyArray<Role>,
  role: SpaceRoleMemberMutationParams["role"]
): Effect.Effect<Role, SpaceRoleIdentifierAmbiguousError | SpaceRoleNotFoundError> =>
  Effect.gen(function*() {
    const byId = roles.find((candidate) => candidate._id === toRef<Role>(role))
    if (byId !== undefined) return byId

    const matches = roles.filter((candidate) => candidate.name === role)

    if (matches.length === 0) {
      return yield* new SpaceRoleNotFoundError({
        identifier: NonEmptyString.make(role),
        spaceType
      })
    }
    if (matches.length > 1) {
      return yield* new SpaceRoleIdentifierAmbiguousError({
        identifier: NonEmptyString.make(role),
        spaceType,
        matches: matches.map((match) => ({
          id: RoleId.make(match._id),
          name: NonEmptyString.make(match.name)
        }))
      })
    }
    return matches[0]
  })

const assignmentValue = (space: GenericSpace, spaceType: SpaceType): unknown =>
  Object.entries(space).find(([key]) => key === spaceType.targetClass)?.[1]

const isObjectRecord = (value: unknown): value is object => typeof value === "object" && value !== null

const assignmentEntries = (
  space: GenericSpace,
  spaceType: SpaceType
): ReadonlyArray<readonly [string, ReadonlyArray<HulyAccountUuid>]> => {
  const current = assignmentValue(space, spaceType)
  if (!isObjectRecord(current)) return []

  return Object.entries(current).flatMap(([roleId, members]) =>
    Array.isArray(members)
      ? [[
        roleId,
        sortStrings(members.filter((member): member is string => typeof member === "string")).map(
          toAccountUuid
        )
      ]]
      : []
  )
}

const roleAssignments = (
  space: GenericSpace,
  spaceType: SpaceType
): Readonly<Record<string, ReadonlyArray<HulyAccountUuid>>> => Object.fromEntries(assignmentEntries(space, spaceType))

const hasRoleAssignmentMixin = (space: GenericSpace, spaceType: SpaceType): boolean =>
  isObjectRecord(assignmentValue(space, spaceType))

const writeSpaceRoleMembers = (
  client: HulyClient["Type"],
  space: GenericSpace,
  spaceType: SpaceType,
  role: Role,
  currentAssignments: Readonly<Record<string, ReadonlyArray<HulyAccountUuid>>>,
  members: ReadonlyArray<HulyAccountUuid>
): Effect.Effect<void, HulyClientError> => {
  const mixin = toMixinRef<SpaceRoleAssignmentsMixin>(spaceType.targetClass)
  const attributes = { ...currentAssignments, [role._id]: members }
  const objectId = toRef<GenericSpace>(space._id)
  const objectClass = toClassRef<GenericSpace>(space._class)
  const objectSpace = toRef<Space>(space.space)

  return hasRoleAssignmentMixin(space, spaceType)
    ? client.updateMixin<GenericSpace, SpaceRoleAssignmentsMixin>(objectId, objectClass, objectSpace, mixin, attributes)
      .pipe(Effect.asVoid)
    : client.createMixin<GenericSpace, SpaceRoleAssignmentsMixin>(objectId, objectClass, objectSpace, mixin, attributes)
      .pipe(Effect.asVoid)
}

type RoleMemberListMutation = (
  currentMembers: ReadonlyArray<HulyAccountUuid>,
  resolvedMembers: ReadonlyArray<HulyAccountUuid>
) => ReadonlyArray<HulyAccountUuid>

const mutateSpaceRoleMembers = (
  params: SpaceRoleMemberMutationParams | SetSpaceRoleMembersParams,
  mutateMembers: RoleMemberListMutation
): Effect.Effect<SpaceRoleMembersResult, SpaceRoleMemberMutationError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const space = yield* findSpace(client, params)
    const spaceType = yield* requireTypedSpaceType(space)
    const spaceTypeDoc = yield* findSpaceType(client, spaceType)
    const roles = yield* listSpaceTypeRoles(client, spaceType)
    const role = yield* resolveSpaceRole(spaceType, roles, params.role)
    const resolvedMembers = yield* resolveMembers(client, params.members)
    const currentAssignments = roleAssignments(space, spaceTypeDoc)
    const currentMembers = sortStrings(currentAssignments[role._id] ?? []).map(toAccountUuid)
    const nextMembers = mutateMembers(currentMembers, resolvedMembers).map(toAccountUuid)
    const changed = !arraysEqual(currentMembers, nextMembers)

    if (changed) {
      yield* writeSpaceRoleMembers(client, space, spaceTypeDoc, role, currentAssignments, nextMembers)
    }

    return {
      id: SpaceId.make(space._id),
      roleId: RoleId.make(role._id),
      members: nextMembers.map((member) => AccountUuid.make(member)),
      changed
    }
  })

type MemberListMutation = (
  currentMembers: ReadonlyArray<HulyAccountUuid>,
  resolvedMembers: ReadonlyArray<HulyAccountUuid>
) => ReadonlyArray<HulyAccountUuid>

const mutateSpaceMembers = (
  params: SpaceMemberMutationParams,
  mutateMembers: MemberListMutation
): Effect.Effect<SpaceMemberMutationResult, SpaceMemberMutationError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const space = yield* findSpace(client, params)
    const resolvedMembers = yield* resolveMembers(client, params.members)
    const nextMembers = mutateMembers(space.members, resolvedMembers).map(toAccountUuid)
    const changed = !arraysEqual(sortStrings(space.members), nextMembers)
    if (changed) {
      yield* updateSpaceDoc(client, space, { members: nextMembers })
    }
    return { id: SpaceId.make(space._id), members: nextMembers.map((member) => AccountUuid.make(member)), changed }
  })

type UpdateSpaceField = typeof UPDATE_SPACE_FIELDS[number]

type UpdateSpaceEntries = {
  readonly [Field in UpdateSpaceField]: DirectUpdateEntry<UpdateSpaceField, DocumentUpdate<GenericSpace>, Field>
}

const buildUpdateSpaceOperations = (params: UpdateSpaceParams): DocumentUpdate<GenericSpace> => {
  const updateEntries = {
    name: params.name === undefined ? {} : { name: params.name },
    description: params.description === undefined ? {} : { description: clearTextAsEmptyString(params.description) },
    private: params.private === undefined ? {} : { private: params.private },
    archived: params.archived === undefined ? {} : { archived: params.archived },
    autoJoin: params.autoJoin === undefined ? {} : { autoJoin: params.autoJoin }
  } satisfies UpdateSpaceEntries

  return mergeUpdateEntries(Object.values(updateEntries))
}

export const updateSpace = (
  params: UpdateSpaceParams
): Effect.Effect<UpdateSpaceResult, UpdateSpaceError, HulyClient> =>
  Effect.gen(function*() {
    yield* requireUpdateFields("update_space", params, UPDATE_SPACE_FIELDS)
    const client = yield* HulyClient
    const space = yield* findSpace(client, params)

    yield* updateSpaceDoc(client, space, buildUpdateSpaceOperations(params))
    return { id: SpaceId.make(space._id), updated: true }
  })

export const addSpaceMembers = (
  params: SpaceMemberMutationParams
): Effect.Effect<SpaceMemberMutationResult, SpaceMemberMutationError, HulyClient> =>
  mutateSpaceMembers(params, mergeUniqueSortedAccountUuids)

export const removeSpaceMembers = (
  params: SpaceMemberMutationParams
): Effect.Effect<SpaceMemberMutationResult, SpaceMemberMutationError, HulyClient> =>
  mutateSpaceMembers(params, removeAccountUuids)

export const setSpaceOwners = (
  params: SetSpaceOwnersParams
): Effect.Effect<SetSpaceOwnersResult, SpaceMemberMutationError, HulyClient> =>
  Effect.gen(function*() {
    const client = yield* HulyClient
    const space = yield* findSpace(client, params)
    const owners = (yield* resolveMembers(client, params.owners)).map(toAccountUuid)
    const ensureMembers = params.ensureMembers ?? DEFAULT_SPACE_OWNER_ENSURE_MEMBERS
    const nextMembers = ensureMembers
      ? mergeUniqueSortedAccountUuids(space.members, owners)
      : sortStrings(space.members)
    const currentOwners = sortStrings(space.owners ?? []).map(toAccountUuid)
    const changedOwners = !arraysEqual(currentOwners, owners)
    const changedMembers = !arraysEqual(sortStrings(space.members), nextMembers)

    if (changedOwners || changedMembers) {
      yield* updateSpaceDoc(client, space, {
        owners,
        ...(changedMembers ? { members: nextMembers } : {})
      })
    }

    return {
      id: SpaceId.make(space._id),
      owners: owners.map((owner) => AccountUuid.make(owner)),
      members: nextMembers.map((member) => AccountUuid.make(member)),
      changed: changedOwners || changedMembers
    }
  })

export const setSpaceRoleMembers = (
  params: SetSpaceRoleMembersParams
): Effect.Effect<SpaceRoleMembersResult, SpaceRoleMemberMutationError, HulyClient> =>
  mutateSpaceRoleMembers(params, (_currentMembers, resolvedMembers) => sortStrings(resolvedMembers).map(toAccountUuid))

export const addSpaceRoleMembers = (
  params: SpaceRoleMemberMutationParams
): Effect.Effect<SpaceRoleMembersResult, SpaceRoleMemberMutationError, HulyClient> =>
  mutateSpaceRoleMembers(params, mergeUniqueSortedAccountUuids)

export const removeSpaceRoleMembers = (
  params: SpaceRoleMemberMutationParams
): Effect.Effect<SpaceRoleMembersResult, SpaceRoleMemberMutationError, HulyClient> =>
  mutateSpaceRoleMembers(params, removeAccountUuids)
