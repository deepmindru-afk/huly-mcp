import { Schema } from "effect"

import { ChannelIdentifier, LimitParam } from "./shared.js"

export const ExternalChannelMessageProviderValues = ["gmail", "telegram"] as const

export const ExternalChannelMessageProviderSchema = Schema.Literal(...ExternalChannelMessageProviderValues)

export const ListExternalChannelMessagesParamsSchema = Schema.Struct({
  provider: ExternalChannelMessageProviderSchema.annotations({
    description:
      "External provider to read from. This build validates gmail and telegram explicitly, but returns a structured unsupported error until compatible Huly SDK message models are available."
  }),
  channel: ChannelIdentifier.annotations({
    description: "Huly external channel name or ID locator."
  }),
  limit: Schema.optional(LimitParam.annotations({
    description: "Maximum number of external messages to return."
  }))
}).annotations({
  title: "ListExternalChannelMessagesParams",
  description: "Parameters for listing read-only Gmail or Telegram external channel messages."
})

export type ListExternalChannelMessagesParams = Schema.Schema.Type<typeof ListExternalChannelMessagesParamsSchema>
