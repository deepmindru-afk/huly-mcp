import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"

import {
  parseGetDriveItemParams,
  parseUploadDriveFileParams,
  uploadDriveFileParamsJsonSchema
} from "../../src/domain/schemas.js"
import { normalizeDrivePath } from "../../src/huly/operations/drive-path.js"

describe("drive schemas", () => {
  it.effect("normalizes POSIX-like paths without filesystem access", () =>
    Effect.gen(function*() {
      expect(normalizeDrivePath("Specs/./API.md")).toEqual({ path: "/Specs/API.md", segments: ["Specs", "API.md"] })
      expect(normalizeDrivePath("/Specs/../Readme.md")).toEqual({ path: "/Readme.md", segments: ["Readme.md"] })
      expect(normalizeDrivePath("/")).toEqual({ path: "/", segments: [] })
    }))

  it.effect("requires exactly one upload source", () =>
    Effect.gen(function*() {
      const accepted = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/Specs/API.md",
        contentType: "text/markdown",
        filePath: "/tmp/API.md"
      })
      const missing = yield* Effect.either(parseUploadDriveFileParams({
        drive: "Docs",
        path: "/Specs/API.md",
        contentType: "text/markdown"
      }))
      const conflicting = yield* Effect.either(parseUploadDriveFileParams({
        drive: "Docs",
        path: "/Specs/API.md",
        contentType: "text/markdown",
        filePath: "/tmp/API.md",
        data: "SGVsbG8="
      }))

      expect(accepted.createParents).toBeUndefined()
      expect(missing._tag).toBe("Left")
      expect(conflicting._tag).toBe("Left")
    }))

  it.effect("rejects ambiguous get item locators", () =>
    Effect.gen(function*() {
      const missing = yield* Effect.either(parseGetDriveItemParams({ drive: "Docs" }))
      const ambiguous = yield* Effect.either(parseGetDriveItemParams({
        drive: "Docs",
        path: "/Specs",
        itemId: "folder-1"
      }))

      expect(missing._tag).toBe("Left")
      expect(ambiguous._tag).toBe("Left")
    }))

  it("exposes source alternatives in upload JSON schema", () => {
    expect(JSON.stringify(uploadDriveFileParamsJsonSchema)).toContain("filePath")
    expect(JSON.stringify(uploadDriveFileParamsJsonSchema)).toContain("fileUrl")
    expect(JSON.stringify(uploadDriveFileParamsJsonSchema)).toContain("data")
  })
})
