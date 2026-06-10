import { describe, it } from "@effect/vitest"
import { Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  parseGetDocumentSnapshotParams,
  parseSetRelatedIssueTargetParams,
  parseUpsertProjectTargetPreferenceParams
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
