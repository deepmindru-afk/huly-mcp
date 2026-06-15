import { describe, it } from "@effect/vitest"
import { Effect, Exit, Predicate } from "effect"
import { expect } from "vitest"

import {
  parseGetDocumentSnapshotParams,
  parseSetRelatedIssueTargetParams,
  parseUpsertProjectTargetPreferenceParams,
  upsertProjectTargetPreferenceParamsJsonSchema
} from "../../src/domain/schemas.js"

describe("issue #102 schemas", () => {
  it.effect("accepts document snapshot lookup by teamspace, document, and snapshot identifier", () =>
    Effect.gen(function*() {
      const parsed = yield* parseGetDocumentSnapshotParams({
        document: "Spec",
        snapshot: "snapshot-1",
        teamspace: "Docs"
      })

      expect(parsed).toEqual({
        document: "Spec",
        snapshot: "snapshot-1",
        teamspace: "Docs"
      })
    }))

  it.effect("keeps ProjectTargetPreference props SDK-open", () =>
    Effect.gen(function*() {
      const parsed = yield* parseUpsertProjectTargetPreferenceParams({
        project: "PRJ",
        props: [{ key: "github:repo", value: { id: 123, enabled: true } }]
      })

      expect(parsed.props?.[0]?.value).toEqual({ id: 123, enabled: true })
    }))

  it("emits client-safe JSON Schema for ProjectTargetPreference prop values", () => {
    if (!Predicate.isRecord(upsertProjectTargetPreferenceParamsJsonSchema)) {
      throw new Error("Expected root schema object")
    }
    const rootProperties = upsertProjectTargetPreferenceParamsJsonSchema.properties
    if (!Predicate.isRecord(rootProperties)) {
      throw new Error("Expected root schema properties")
    }
    const props = rootProperties.props
    if (!Predicate.isRecord(props) || !Predicate.isRecord(props.items)) {
      throw new Error("Expected props array schema")
    }
    const itemProperties = props.items.properties
    if (!Predicate.isRecord(itemProperties)) {
      throw new Error("Expected props item properties")
    }

    expect(itemProperties.value).toEqual({
      description: "SDK-open target preference property value. Passed through to Huly without narrowing.",
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "object", additionalProperties: true },
        { type: "array", items: {} },
        { type: "null" }
      ]
    })
  })

  it.effect("requires exactly one related issue target locator", () =>
    Effect.gen(function*() {
      const missing = yield* Effect.exit(parseSetRelatedIssueTargetParams({ targetProject: null }))
      const both = yield* Effect.exit(parseSetRelatedIssueTargetParams({
        objectClass: "document:class:Document",
        space: "Docs",
        targetProject: "PRJ"
      }))
      const valid = yield* parseSetRelatedIssueTargetParams({
        space: "Docs",
        targetProject: null
      })

      expect(Exit.isFailure(missing)).toBe(true)
      expect(Exit.isFailure(both)).toBe(true)
      expect(valid).toEqual({ space: "Docs", targetProject: null })
    }))
})
