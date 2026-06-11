/**
 * Chat conversation schemas for channel membership, channel lifecycle,
 * group direct-message creation, and per-user conversation state.
 */
import { JSONSchema, Schema } from "effect"

import type { ChannelId, NotificationContextId, PersonName } from "./shared.js"
import {
  AccountUuid,
  ChannelIdentifier,
  DirectMessageIdentifier,
  PersonRefInput,
  withAtLeastOneRequired,
  withMutuallyExclusiveFields
} from "./shared.js"

export const GroupDirectMessageMinimumOtherPeople = 2

export const ChannelMemberIdentifier = Schema.Union(AccountUuid, PersonRefInput).annotations({
  description:
    "Workspace channel member to resolve. Accepts a Huly account UUID directly, an exact email address, or an exact person display name."
})
export type ChannelMemberIdentifier = Schema.Schema.Type<typeof ChannelMemberIdentifier>

export interface ChannelMemberSummary {
  readonly accountUuid: AccountUuid
  readonly name?: PersonName | undefined
}

export interface ListChannelMembersResult {
  readonly channelId: ChannelId
  readonly members: ReadonlyArray<ChannelMemberSummary>
}

export interface ChannelMemberMutationResult {
  readonly channelId: ChannelId
  readonly members: ReadonlyArray<AccountUuid>
  readonly changed: boolean
}

export interface ChannelArchiveResult {
  readonly channelId: ChannelId
  readonly archived: boolean
  readonly changed: boolean
}

export interface CreateGroupDirectMessageResult {
  readonly id: ChannelId
  readonly created: boolean
  readonly members: ReadonlyArray<AccountUuid>
}

export type ConversationKind = "channel" | "direct_message"

export interface ConversationStateResult {
  readonly kind: ConversationKind
  readonly objectId: ChannelId
  readonly contextId: NotificationContextId
  readonly starred: boolean
  readonly closed: boolean
  readonly changed: boolean
}

export const ListChannelMembersParamsSchema = Schema.Struct({
  channel: ChannelIdentifier.annotations({
    description: "Channel name or ID whose members should be listed."
  })
}).annotations({
  title: "ListChannelMembersParams",
  description: "Parameters for listing channel members."
})
export type ListChannelMembersParams = Schema.Schema.Type<typeof ListChannelMembersParamsSchema>

export const ChannelMemberMutationParamsSchema = Schema.Struct({
  channel: ChannelIdentifier.annotations({
    description: "Channel name or ID whose members should change."
  }),
  members: Schema.Array(ChannelMemberIdentifier).pipe(Schema.minItems(1)).annotations({
    description:
      "Members to add or remove. Each entry may be an account UUID, exact email address, or exact person display name."
  })
}).annotations({
  title: "ChannelMemberMutationParams",
  description: "Parameters for adding or removing channel members."
})
export type ChannelMemberMutationParams = Schema.Schema.Type<typeof ChannelMemberMutationParamsSchema>

export const ChannelLifecycleParamsSchema = Schema.Struct({
  channel: ChannelIdentifier.annotations({
    description: "Channel name or ID whose archive state should change."
  })
}).annotations({
  title: "ChannelLifecycleParams",
  description: "Parameters for archiving or unarchiving a channel."
})
export type ChannelLifecycleParams = Schema.Schema.Type<typeof ChannelLifecycleParamsSchema>

export const CreateGroupDirectMessageParamsSchema = Schema.Struct({
  people: Schema.Array(PersonRefInput).pipe(Schema.minItems(GroupDirectMessageMinimumOtherPeople)).annotations({
    description:
      "At least two other workspace members to include in a group DM. Each entry accepts an exact email address or exact person display name. The authenticated account is included automatically."
  })
}).annotations({
  title: "CreateGroupDirectMessageParams",
  description: "Parameters for creating or resolving a group direct-message conversation by exact participant set."
})
export type CreateGroupDirectMessageParams = Schema.Schema.Type<typeof CreateGroupDirectMessageParamsSchema>

const ConversationTargetSchema = Schema.Struct({
  channel: Schema.optional(ChannelIdentifier.annotations({
    description: "Channel name or ID. Provide exactly one of channel or dm."
  })),
  dm: Schema.optional(DirectMessageIdentifier.annotations({
    description:
      "Direct-message conversation ID, or a one-to-one participant display name. Provide exactly one of channel or dm."
  }))
}).pipe(
  Schema.filter((params) => {
    if (params.channel === undefined && params.dm === undefined) {
      return "Provide exactly one of channel or dm."
    }
    if (params.channel !== undefined && params.dm !== undefined) {
      return "Provide exactly one of channel or dm, not both."
    }
    return undefined
  })
)

export const SetConversationStarredParamsSchema = Schema.extend(
  ConversationTargetSchema,
  Schema.Struct({
    starred: Schema.Boolean.annotations({
      description: "True to star/pin this conversation for the authenticated user, false to unstar it."
    })
  })
).annotations({
  title: "SetConversationStarredParams",
  description:
    "Parameters for setting the authenticated user's starred state for a channel or direct-message conversation."
})
export type SetConversationStarredParams = Schema.Schema.Type<typeof SetConversationStarredParamsSchema>

export const SetConversationClosedParamsSchema = Schema.extend(
  ConversationTargetSchema,
  Schema.Struct({
    closed: Schema.Boolean.annotations({
      description:
        "True to close/hide this conversation for the authenticated user, false to reopen it. Does not leave channels or remove members."
    })
  })
).annotations({
  title: "SetConversationClosedParams",
  description:
    "Parameters for setting the authenticated user's closed/visible state for a channel or direct-message conversation."
})
export type SetConversationClosedParams = Schema.Schema.Type<typeof SetConversationClosedParamsSchema>

const withExactlyOneConversationTarget = (schema: object): object =>
  withMutuallyExclusiveFields(withAtLeastOneRequired(schema, ["channel", "dm"]), ["channel", "dm"])

export const listChannelMembersParamsJsonSchema = JSONSchema.make(ListChannelMembersParamsSchema)
export const channelMemberMutationParamsJsonSchema = JSONSchema.make(ChannelMemberMutationParamsSchema)
export const channelLifecycleParamsJsonSchema = JSONSchema.make(ChannelLifecycleParamsSchema)
export const createGroupDirectMessageParamsJsonSchema = JSONSchema.make(CreateGroupDirectMessageParamsSchema)
export const setConversationStarredParamsJsonSchema = withExactlyOneConversationTarget(
  JSONSchema.make(SetConversationStarredParamsSchema)
)
export const setConversationClosedParamsJsonSchema = withExactlyOneConversationTarget(
  JSONSchema.make(SetConversationClosedParamsSchema)
)

export const parseListChannelMembersParams = Schema.decodeUnknown(ListChannelMembersParamsSchema)
export const parseChannelMemberMutationParams = Schema.decodeUnknown(ChannelMemberMutationParamsSchema)
export const parseChannelLifecycleParams = Schema.decodeUnknown(ChannelLifecycleParamsSchema)
export const parseCreateGroupDirectMessageParams = Schema.decodeUnknown(CreateGroupDirectMessageParamsSchema)
export const parseSetConversationStarredParams = Schema.decodeUnknown(SetConversationStarredParamsSchema)
export const parseSetConversationClosedParams = Schema.decodeUnknown(SetConversationClosedParamsSchema)
