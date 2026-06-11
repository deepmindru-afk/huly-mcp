import { Effect } from "effect"

import type { ListExternalChannelMessagesParams } from "../../domain/schemas/external-channel-messages.js"
import { ExternalChannelProviderUnsupportedError } from "../errors.js"

const EXTERNAL_CHANNEL_PACKAGE_INCOMPATIBLE_REASON =
  "package-incompatible: package.json and pnpm-lock.yaml include @hcengineering/contact provider refs for email/telegram, but no compatible Huly Gmail or Telegram message SDK package/model is installed; local platform-api examples only expose contact.class.Channel provider values, not external message documents"

/**
 * Task-1 compatibility assessment:
 * - Existing imports support internal chat via @hcengineering/chunter ChatMessage/Channel/DirectMessage.
 * - Contact channels expose @hcengineering/contact contact.channelProvider.Email and .Telegram only as contact methods.
 * - No locked @hcengineering Gmail/Telegram communication package or local platform-api example exposes read-only external messages.
 */
export const listExternalChannelMessages = (
  params: ListExternalChannelMessagesParams
): Effect.Effect<never, ExternalChannelProviderUnsupportedError> =>
  Effect.fail(
    new ExternalChannelProviderUnsupportedError({
      provider: params.provider,
      reason: EXTERNAL_CHANNEL_PACKAGE_INCOMPATIBLE_REASON
    })
  )
