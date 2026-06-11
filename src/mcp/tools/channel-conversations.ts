import {
  channelLifecycleParamsJsonSchema,
  channelMemberMutationParamsJsonSchema,
  createGroupDirectMessageParamsJsonSchema,
  listChannelMembersParamsJsonSchema,
  parseChannelLifecycleParams,
  parseChannelMemberMutationParams,
  parseCreateGroupDirectMessageParams,
  parseListChannelMembersParams,
  parseSetConversationClosedParams,
  parseSetConversationStarredParams,
  setConversationClosedParamsJsonSchema,
  setConversationStarredParamsJsonSchema
} from "../../domain/schemas.js"
import {
  addChannelMembers,
  archiveChannel,
  createGroupDirectMessage,
  joinChannel,
  leaveChannel,
  listChannelMembers,
  removeChannelMembers,
  setConversationClosed,
  setConversationStarred,
  unarchiveChannel
} from "../../huly/operations/channels.js"
import { createToolHandler, type RegisteredTool } from "./registry.js"

const CATEGORY = "channels" as const

export const channelConversationTools: ReadonlyArray<RegisteredTool> = [
  {
    name: "list_channel_members",
    description:
      "List members of a Huly channel by channel name or ID. Returns each member account UUID and the workspace display name when available.",
    category: CATEGORY,
    inputSchema: listChannelMembersParamsJsonSchema,
    handler: createToolHandler(
      "list_channel_members",
      parseListChannelMembersParams,
      listChannelMembers
    )
  },
  {
    name: "add_channel_members",
    description:
      "Idempotently add members to a non-archived Huly channel. Members accept account UUID, exact email, or exact person display name and resolve to Huly account UUIDs before replacing the full sorted member array.",
    category: CATEGORY,
    inputSchema: channelMemberMutationParamsJsonSchema,
    handler: createToolHandler(
      "add_channel_members",
      parseChannelMemberMutationParams,
      addChannelMembers
    )
  },
  {
    name: "remove_channel_members",
    description:
      "Idempotently remove members from a non-archived Huly channel. Members accept account UUID, exact email, or exact person display name. Refuses removals that would leave the channel with zero members or, when owners exist, no owner among remaining members.",
    category: CATEGORY,
    inputSchema: channelMemberMutationParamsJsonSchema,
    handler: createToolHandler(
      "remove_channel_members",
      parseChannelMemberMutationParams,
      removeChannelMembers
    )
  },
  {
    name: "join_channel",
    description:
      "Join a non-archived Huly channel as the authenticated account. Idempotent when the account is already a member.",
    category: CATEGORY,
    inputSchema: channelLifecycleParamsJsonSchema,
    handler: createToolHandler(
      "join_channel",
      parseChannelLifecycleParams,
      joinChannel
    )
  },
  {
    name: "leave_channel",
    description:
      "Leave a non-archived Huly channel as the authenticated account. Idempotent when already absent. Refuses to leave if that would leave the channel empty or without any remaining owner.",
    category: CATEGORY,
    inputSchema: channelLifecycleParamsJsonSchema,
    handler: createToolHandler(
      "leave_channel",
      parseChannelLifecycleParams,
      leaveChannel
    )
  },
  {
    name: "archive_channel",
    description:
      "Archive a Huly channel by channel name or ID. This is reversible with unarchive_channel and is idempotent when the channel is already archived.",
    category: CATEGORY,
    inputSchema: channelLifecycleParamsJsonSchema,
    handler: createToolHandler(
      "archive_channel",
      parseChannelLifecycleParams,
      archiveChannel
    )
  },
  {
    name: "unarchive_channel",
    description: "Unarchive a Huly channel by channel name or ID. Idempotent when the channel is already active.",
    category: CATEGORY,
    inputSchema: channelLifecycleParamsJsonSchema,
    handler: createToolHandler(
      "unarchive_channel",
      parseChannelLifecycleParams,
      unarchiveChannel
    )
  },
  {
    name: "create_group_direct_message",
    description:
      "Open a group direct-message conversation with at least two other workspace members. The `people` array accepts exact emails or exact display names; the authenticated account is included automatically. Idempotent by exact sorted member set: returns an existing group DM with `created: false` when one already exists. For one other person, use create_direct_message.",
    category: CATEGORY,
    inputSchema: createGroupDirectMessageParamsJsonSchema,
    handler: createToolHandler(
      "create_group_direct_message",
      parseCreateGroupDirectMessageParams,
      createGroupDirectMessage
    )
  },
  {
    name: "set_conversation_starred",
    description:
      "Set the authenticated user's starred state for exactly one conversation. Provide either `channel` (channel name or ID) or `dm` (DM ID, or one-to-one participant display name), plus `starred`. Creates the missing notification context when needed.",
    category: CATEGORY,
    inputSchema: setConversationStarredParamsJsonSchema,
    handler: createToolHandler(
      "set_conversation_starred",
      parseSetConversationStarredParams,
      setConversationStarred
    )
  },
  {
    name: "set_conversation_closed",
    description:
      "Set the authenticated user's closed/visible state for exactly one conversation. Provide either `channel` or `dm`, plus `closed`. Closing only hides the current user's notification context; it does not leave channels or remove members.",
    category: CATEGORY,
    inputSchema: setConversationClosedParamsJsonSchema,
    handler: createToolHandler(
      "set_conversation_closed",
      parseSetConversationClosedParams,
      setConversationClosed
    )
  }
]
