import type { Channel, ChannelProvider } from "@hcengineering/contact"
import type { Doc, PersonId as CorePersonId } from "@hcengineering/core"
import { Effect, Exit } from "effect"
import { describe, expect, it } from "vitest"

import { ContactChannelProviderValues } from "../../domain/schemas/contact-channels.js"
import { contact } from "../huly-plugins.js"
import { channelSummary } from "./contact-channel-mappers.js"
import {
  fromContactChannelProviderRef,
  listContactChannelProviderLabels,
  toContactChannelProviderRef
} from "./contact-channel-providers.js"
import { toRef } from "./sdk-boundary.js"

const testRef: typeof toRef = toRef

// Brands are erased at runtime; the SDK PersonId brand is a string in test fixtures.
const testCorePersonId = (id: string): CorePersonId => id as CorePersonId

const channel = (provider: string): Channel => {
  const data: Channel = {
    _id: testRef<Channel>("channel-1"),
    _class: contact.class.Channel,
    space: contact.space.Contacts,
    attachedTo: testRef<Doc>("person-1"),
    attachedToClass: contact.class.Person,
    collection: "channels",
    provider: testRef<ChannelProvider>(provider),
    value: "value",
    modifiedBy: testCorePersonId("user"),
    modifiedOn: 0,
    createdBy: testCorePersonId("user"),
    createdOn: 0
  }
  return data
}

describe("Contact Channel Provider Mapping", () => {
  it("round-trips every provider label through Huly refs", () => {
    expect(listContactChannelProviderLabels()).toEqual(ContactChannelProviderValues)

    for (const provider of ContactChannelProviderValues) {
      expect(fromContactChannelProviderRef(toContactChannelProviderRef(provider))).toBe(provider)
    }
  })

  it("returns typed errors for unknown provider refs", async () => {
    const mapped = fromContactChannelProviderRef("contact:channelProvider:Fax")
    expect(typeof mapped === "object" && "_tag" in mapped ? mapped._tag : undefined).toBe(
      "InvalidContactProviderError"
    )

    const result = await Effect.runPromiseExit(channelSummary(channel("contact:channelProvider:Fax")))
    expect(Exit.isFailure(result)).toBe(true)
  })
})
