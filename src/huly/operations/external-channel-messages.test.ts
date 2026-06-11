import { describe, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"
import { expect } from "vitest"

import {
  ExternalChannelMessageProviderValues,
  ListExternalChannelMessagesParamsSchema
} from "../../domain/schemas/external-channel-messages.js"
import { ChannelIdentifier } from "../../domain/schemas/shared.js"
import { listExternalChannelMessages } from "./external-channel-messages.js"

const decodeParams = Schema.decodeUnknownEither(ListExternalChannelMessagesParamsSchema)

describe("external channel messages", () => {
  it("validates the assessed external providers", () => {
    expect(Either.isRight(decodeParams({ provider: "gmail", channel: "Inbox", limit: 10 }))).toBe(true)
    expect(Either.isRight(decodeParams({ provider: "telegram", channel: "Ops" }))).toBe(true)
  })

  it("rejects providers outside the assessed compatibility set", () => {
    expect(Either.isLeft(decodeParams({ provider: "email", channel: "Inbox" }))).toBe(true)
    expect(Either.isLeft(decodeParams({ provider: "slack", channel: "Ops" }))).toBe(true)
  })

  it.effect("returns structured unsupported errors for package-incompatible providers", () =>
    Effect.gen(function*() {
      for (const provider of ExternalChannelMessageProviderValues) {
        const result = yield* Effect.either(
          listExternalChannelMessages({ provider, channel: ChannelIdentifier.make("Inbox"), limit: 5 })
        )

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe("ExternalChannelProviderUnsupportedError")
          expect(result.left.provider).toBe(provider)
          expect(result.left.reason).toContain("package-incompatible")
          expect(result.left.reason).toContain("@hcengineering/contact")
          expect(result.left.reason).toContain("Huly Gmail or Telegram message SDK")
        }
      }
    }))
})
