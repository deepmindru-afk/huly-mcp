import { describe, it } from "@effect/vitest"
import type { Class, Data, Doc, DocumentQuery, DocumentUpdate, Ref, Space, SpaceType } from "@hcengineering/core"
import { toFindResult } from "@hcengineering/core"
import { Effect } from "effect"
import { expect } from "vitest"

import type { HulyClientOperations } from "../../../src/huly/client.js"
import { drive, type DriveSpace, type File, type Folder } from "../../../src/huly/drive-sdk.js"
import { core } from "../../../src/huly/huly-plugins.js"
import { testMarkupUrlConfig } from "../../../src/huly/operations/markup.js"
import { toAccountUuid, toRef } from "../../../src/huly/operations/sdk-boundary.js"
import type { HulyStorageOperations } from "../../../src/huly/storage.js"
import { testWorkbenchUrlConfig } from "../../../src/huly/url-builders.js"
import { McpErrorCode } from "../../../src/mcp/error-mapping.js"
import { driveTools } from "../../../src/mcp/tools/drive.js"
import { TOOL_DEFINITIONS } from "../../../src/mcp/tools/index.js"
import { corePersonId } from "../../helpers/huly-sdk.js"

interface DriveToolState {
  readonly drives: Array<DriveSpace>
  readonly folders: Array<Folder>
  readonly files: Array<File>
  nextId: number
}

const personId = corePersonId("drive-tool-person")
const accountA = toAccountUuid("00000000-0000-4000-8000-000000000001")
const accountB = toAccountUuid("00000000-0000-4000-8000-000000000002")

const driveSpace = (id = "drive-1", name = "Docs"): DriveSpace => ({
  _id: toRef<DriveSpace>(id),
  _class: drive.class.Drive,
  space: toRef<Space>(core.space.Space),
  name,
  description: "Drive docs",
  private: false,
  archived: false,
  autoJoin: false,
  type: toRef<SpaceType>(drive.spaceType.DefaultDrive),
  members: [accountA],
  owners: [accountA],
  modifiedBy: personId,
  modifiedOn: 0,
  createdBy: personId,
  createdOn: 0
})

const folder = (id: string, title: string): Folder => ({
  _id: toRef<Folder>(id),
  _class: drive.class.Folder,
  space: toRef<DriveSpace>("drive-1"),
  title,
  parent: drive.ids.Root,
  path: [],
  modifiedBy: personId,
  modifiedOn: 0,
  createdBy: personId,
  createdOn: 0
})

const matchesQuery = (doc: Doc, query: DocumentQuery<Doc>): boolean =>
  Object.entries(query).every(([key, value]) => Reflect.get(doc, key) === value)

const documentsForClass = (state: DriveToolState, classRef: Ref<Class<Doc>>): ReadonlyArray<Doc> =>
  classRef === drive.class.Drive
    ? state.drives
    : classRef === drive.class.Folder
    ? state.folders
    : classRef === drive.class.File
    ? state.files
    : []

const makeHulyClient = (state: DriveToolState): HulyClientOperations => ({
  getAccountUuid: () => accountA,
  getPrimarySocialId: () => personId,
  markupUrlConfig: testMarkupUrlConfig,
  workbenchUrlConfig: testWorkbenchUrlConfig,
  findAll: <T extends Doc>(classRef: Ref<Class<T>>, query: DocumentQuery<T>) => {
    const docs = documentsForClass(state, classRef as Ref<Class<Doc>>)
    return Effect.succeed(
      // The class ref selects the fixture array; Huly SDK brands are erased at runtime.
      // eslint-disable-next-line no-restricted-syntax -- brands erased at runtime; class branch selects T
      toFindResult(docs.filter((doc) => matchesQuery(doc, query as DocumentQuery<Doc>)) as unknown as Array<T>)
    )
  },
  findOne: <T extends Doc>(classRef: Ref<Class<T>>, query: DocumentQuery<T>) =>
    Effect.map(makeHulyClient(state).findAll(classRef, query), (docs) => docs[0]),
  createDoc: <T extends Doc>(
    classRef: Ref<Class<T>>,
    space: Ref<Space>,
    attributes: Data<T>,
    id?: Ref<T>
  ) => {
    const next = id ?? toRef<T>(`created-${state.nextId++}`)
    if (classRef === drive.class.Drive) {
      state.drives.push({
        // eslint-disable-next-line no-restricted-syntax -- brands erased at runtime; Drive class branch selects DriveSpace
        _id: next as unknown as Ref<DriveSpace>,
        _class: drive.class.Drive,
        space,
        modifiedBy: personId,
        modifiedOn: 0,
        createdBy: personId,
        createdOn: 0,
        // eslint-disable-next-line no-restricted-syntax -- brands erased at runtime; Drive class branch selects DriveSpace data
        ...(attributes as unknown as Data<DriveSpace>)
      })
    }
    return Effect.succeed(next)
  },
  updateDoc: <T extends Doc>(
    _classRef: Ref<Class<T>>,
    _space: Ref<Space>,
    objectId: Ref<T>,
    operations: DocumentUpdate<T>
  ) => {
    const targetIndex = state.drives.findIndex((candidate) => String(candidate._id) === String(objectId))
    const target = state.drives[targetIndex]
    state.drives[targetIndex] = {
      ...target,
      // eslint-disable-next-line no-restricted-syntax -- brands erased at runtime; test updates only Drive docs
      ...(operations as unknown as Partial<DriveSpace>)
    }
    return Effect.succeed([])
  },
  removeDoc: <T extends Doc>(_classRef: Ref<Class<T>>, _space: Ref<Space>, objectId: Ref<T>) => {
    const index = state.drives.findIndex((candidate) => String(candidate._id) === String(objectId))
    if (index >= 0) state.drives.splice(index, 1)
    return Effect.succeed([])
  },
  addCollection: () => Effect.die(new Error("not implemented")),
  removeCollection: () => Effect.die(new Error("not implemented")),
  uploadMarkup: () => Effect.die(new Error("not implemented")),
  fetchMarkup: () => Effect.succeed(""),
  updateMarkup: () => Effect.die(new Error("not implemented")),
  updateMixin: () => Effect.die(new Error("not implemented")),
  createMixin: () => Effect.die(new Error("not implemented")),
  searchFulltext: () => Effect.die(new Error("not implemented"))
})

const storageClient: HulyStorageOperations = {
  uploadFile: () => Effect.die(new Error("not implemented")),
  getFileUrl: (blobId) => `https://test.huly.io/files?file=${blobId}`
}

const findTool = (name: string) => {
  const tool = driveTools.find((candidate) => candidate.name === name)
  if (tool === undefined) throw new Error(`Tool ${name} not found`)
  return tool
}

describe("driveTools", () => {
  it.effect("exports Drive tools in the drive category and registers them globally", () =>
    Effect.gen(function*() {
      expect(driveTools.map((tool) => tool.name)).toEqual([
        "list_drives",
        "get_drive",
        "create_drive",
        "update_drive",
        "delete_drive",
        "add_drive_members",
        "remove_drive_members",
        "set_drive_owners",
        "list_drive_items",
        "get_drive_item",
        "create_drive_folder",
        "upload_drive_file",
        "upload_drive_file_version",
        "move_drive_item",
        "rename_drive_item",
        "delete_drive_item",
        "list_drive_file_versions",
        "restore_drive_file_version"
      ])

      for (const tool of driveTools) {
        expect(tool.category).toBe("drive")
        expect(TOOL_DEFINITIONS[tool.name]).toBe(tool)
      }

      expect(driveTools.find((tool) => tool.name === "move_drive_item")?.description).toContain(
        "file or folder"
      )
      expect(driveTools.find((tool) => tool.name === "create_drive")?.description).toContain(
        "created=false"
      )
      expect(driveTools.find((tool) => tool.name === "set_drive_owners")?.description).toContain(
        "ensured as a Drive member"
      )
      expect(driveTools.find((tool) => tool.name === "delete_drive")?.description).toContain(
        "empty Huly Drive space"
      )
      expect(driveTools.find((tool) => tool.name === "delete_drive_item")?.description).toContain(
        "permanent deletion"
      )
    }))

  it.effect("Drive administration handlers encode successful structured output", () =>
    Effect.gen(function*() {
      const state: DriveToolState = {
        drives: [driveSpace()],
        folders: [],
        files: [],
        nextId: 1
      }
      const hulyClient = makeHulyClient(state)

      const created = yield* Effect.promise(() =>
        findTool("create_drive").handler(
          { name: "Team Drive", members: [accountA], owners: [accountB] },
          hulyClient,
          storageClient
        )
      )
      const updated = yield* Effect.promise(() =>
        findTool("update_drive").handler({ drive: "Docs", autoJoin: true }, hulyClient, storageClient)
      )
      const added = yield* Effect.promise(() =>
        findTool("add_drive_members").handler({ drive: "Docs", members: [accountB] }, hulyClient, storageClient)
      )
      const removed = yield* Effect.promise(() =>
        findTool("remove_drive_members").handler({ drive: "Docs", members: [accountA] }, hulyClient, storageClient)
      )
      const owners = yield* Effect.promise(() =>
        findTool("set_drive_owners").handler({ drive: "Docs", owners: [accountB] }, hulyClient, storageClient)
      )
      const deleted = yield* Effect.promise(() =>
        findTool("delete_drive").handler({ drive: "Team Drive" }, hulyClient, storageClient)
      )

      expect(created.isError).toBeUndefined()
      expect(created.structuredContent?.result).toMatchObject({ created: true, drive: { name: "Team Drive" } })
      expect(JSON.parse(created.content[0].text)).toMatchObject({ created: true })
      expect(updated.structuredContent?.result).toMatchObject({ updated: true, drive: { autoJoin: true } })
      expect(added.structuredContent?.result).toMatchObject({ changed: true, members: [accountA, accountB] })
      expect(removed.structuredContent?.result).toMatchObject({ changed: true, members: [accountB] })
      expect(owners.structuredContent?.result).toMatchObject({
        changed: true,
        owners: [accountB],
        members: [accountB]
      })
      expect(deleted.structuredContent?.result).toMatchObject({ deleted: true, drive: { name: "Team Drive" } })
    }))

  it.effect("Drive administration handlers map parse and domain errors", () =>
    Effect.gen(function*() {
      const nonEmptyState: DriveToolState = {
        drives: [driveSpace()],
        folders: [folder("folder-specs", "Specs")],
        files: [],
        nextId: 1
      }
      const hulyClient = makeHulyClient(nonEmptyState)

      const parseError = yield* Effect.promise(() =>
        findTool("update_drive").handler({ drive: "Docs" }, hulyClient, storageClient)
      )
      const domainError = yield* Effect.promise(() =>
        findTool("delete_drive").handler({ drive: "Docs" }, hulyClient, storageClient)
      )

      expect(parseError.isError).toBe(true)
      expect(parseError._meta?.errorCode).toBe(McpErrorCode.InvalidParams)
      expect(parseError.content[0].text).toContain("Invalid parameters for update_drive")
      expect(domainError.isError).toBe(true)
      expect(domainError._meta?.errorCode).toBe(McpErrorCode.InvalidParams)
      expect(domainError.content[0].text).toContain("Drive 'Docs' is not empty")
    }))
})
