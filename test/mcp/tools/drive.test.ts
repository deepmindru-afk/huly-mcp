import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"

import { driveTools } from "../../../src/mcp/tools/drive.js"
import { TOOL_DEFINITIONS } from "../../../src/mcp/tools/index.js"

describe("driveTools", () => {
  it.effect("exports Drive tools in the drive category and registers them globally", () =>
    Effect.gen(function*() {
      expect(driveTools.map((tool) => tool.name)).toEqual([
        "list_drives",
        "get_drive",
        "list_drive_items",
        "get_drive_item",
        "create_drive_folder",
        "upload_drive_file",
        "list_drive_file_versions",
        "restore_drive_file_version"
      ])

      for (const tool of driveTools) {
        expect(tool.category).toBe("drive")
        expect(TOOL_DEFINITIONS[tool.name]).toBe(tool)
      }
    }))
})
