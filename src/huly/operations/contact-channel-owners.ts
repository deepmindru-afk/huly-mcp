import type { Organization as HulyOrganization, Person as HulyPerson } from "@hcengineering/contact"
import type { Class, Ref } from "@hcengineering/core"
import { Effect, Schema } from "effect"

import { Email, PersonName } from "../../domain/schemas/shared.js"
import type { HulyClient, HulyClientError } from "../client.js"
import type {
  OrganizationIdentifierAmbiguousError,
  OrganizationNotFoundError,
  PersonIdentifierAmbiguousError
} from "../errors.js"
import { PersonNotFoundError } from "../errors.js"
import { contact } from "../huly-plugins.js"
import { findPersonByExactEmailOrName, findPersonById } from "./contacts-shared.js"
import { resolveOrganizationByIdentifier } from "./organization-resolvers.js"

export type ChannelOwner = HulyPerson | HulyOrganization

export interface ResolvedOwner<Owner extends ChannelOwner> {
  readonly id: Ref<Owner>
  readonly ownerClass: Ref<Class<Owner>>
  readonly identifier: string
}

const resolvePerson = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<HulyPerson, HulyClientError | PersonIdentifierAmbiguousError | PersonNotFoundError> =>
  Effect.gen(function*() {
    const byId = yield* findPersonById(client, identifier)
    if (byId !== undefined) return byId

    const byEmailOrName = yield* findPersonByExactEmailOrName(
      client,
      Schema.is(Email)(identifier) ? identifier : PersonName.make(identifier)
    )
    if (byEmailOrName !== undefined) return byEmailOrName

    return yield* new PersonNotFoundError({ identifier })
  })

export const resolvePersonOwner = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<ResolvedOwner<HulyPerson>, HulyClientError | PersonIdentifierAmbiguousError | PersonNotFoundError> =>
  Effect.map(resolvePerson(client, identifier), (person) => ({
    id: person._id,
    ownerClass: contact.class.Person,
    identifier
  }))

export const resolveOrganizationOwner = (
  client: HulyClient["Type"],
  identifier: string
): Effect.Effect<
  ResolvedOwner<HulyOrganization>,
  HulyClientError | OrganizationIdentifierAmbiguousError | OrganizationNotFoundError
> =>
  Effect.gen(function*() {
    const org = yield* resolveOrganizationByIdentifier(client, identifier)
    return { id: org._id, ownerClass: contact.class.Organization, identifier }
  })
