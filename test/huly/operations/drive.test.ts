/* eslint-disable no-restricted-syntax -- Huly SDK phantom refs are erased at runtime; these tests centralize fixture casts. */
import { describe, it } from "@effect/vitest"
import type {
  AttachedData,
  AttachedDoc,
  Blob,
  Class,
  Data,
  Doc,
  DocumentQuery,
  DocumentUpdate,
  Ref,
  Space
} from "@hcengineering/core"
import { Effect, Layer, TestClock } from "effect"
import { expect } from "vitest"

import {
  parseCreateDriveFolderParams,
  parseGetDriveItemParams,
  parseGetDriveParams,
  parseListDriveFileVersionsParams,
  parseListDriveItemsParams,
  parseListDrivesParams,
  parseRestoreDriveFileVersionParams,
  parseUploadDriveFileParams
} from "../../../src/domain/schemas.js"
import { BlobId } from "../../../src/domain/schemas/shared.js"
import { HulyClient, type HulyClientOperations } from "../../../src/huly/client.js"
import { drive, type DriveSpace, type File, type FileVersion, type Folder } from "../../../src/huly/drive-sdk.js"
import {
  DriveFileNotFoundError,
  DriveFileVersionNotFoundError,
  DriveIdentifierAmbiguousError,
  DriveNotFoundError,
  DriveParentNotFolderError,
  DrivePathAmbiguousError,
  DrivePathConflictError,
  DrivePathNotFoundError
} from "../../../src/huly/errors-drive.js"
import {
  createDriveFolder,
  getDrive,
  getDriveItem,
  listDriveFileVersions,
  listDriveItems,
  listDrives,
  restoreDriveFileVersion,
  uploadDriveFile
} from "../../../src/huly/operations/drive.js"
import { toRef } from "../../../src/huly/operations/sdk-boundary.js"
import { HulyStorageClient, type HulyStorageOperations } from "../../../src/huly/storage.js"
import { testWorkbenchUrlConfig } from "../../../src/huly/url-builders.js"
import { corePersonId, findResult } from "../../helpers/huly-sdk.js"

interface DriveState {
  readonly drives: Array<DriveSpace>
  readonly folders: Array<Folder>
  readonly files: Array<File>
  readonly versions: Array<FileVersion>
  nextId: number
  updatedFile?: { readonly id: string; readonly operations: DocumentUpdate<File> }
}

const personId = corePersonId("person-1")
const driveSpace = (id = "drive-1", name = "Docs"): DriveSpace => ({
  _id: toRef<DriveSpace>(id),
  _class: drive.class.Drive,
  space: toRef<Space>("core:space:Space"),
  name,
  description: "Drive docs",
  private: false,
  archived: false,
  members: [],
  owners: [],
  modifiedBy: personId,
  modifiedOn: 0,
  createdBy: personId,
  createdOn: 0
} as unknown as DriveSpace)

const folder = (id: string, title: string, parent: Ref<Folder>, path: ReadonlyArray<Ref<Folder>> = []): Folder => ({
  _id: toRef<Folder>(id),
  _class: drive.class.Folder,
  space: toRef<DriveSpace>("drive-1"),
  title,
  parent,
  path,
  modifiedBy: personId,
  modifiedOn: 0,
  createdBy: personId,
  createdOn: 0
})

const file = (
  id: string,
  title: string,
  parent: Ref<Folder>,
  path: ReadonlyArray<Ref<Folder>>,
  versionId = "version-1",
  version = 1
): File => ({
  _id: toRef<File>(id),
  _class: drive.class.File,
  space: toRef<DriveSpace>("drive-1"),
  title,
  parent,
  path,
  file: toRef<FileVersion>(versionId),
  versions: 1,
  version,
  modifiedBy: personId,
  modifiedOn: 0,
  createdBy: personId,
  createdOn: 0
})

const version = (
  id: string,
  attachedTo: Ref<File>,
  n: number,
  blobId = `blob-${n}`
): FileVersion => ({
  _id: toRef<FileVersion>(id),
  _class: drive.class.FileVersion,
  space: toRef<DriveSpace>("drive-1"),
  attachedTo,
  attachedToClass: drive.class.File,
  collection: "versions",
  title: "API.md",
  file: toRef<Blob>(blobId),
  size: 12,
  type: "text/markdown",
  lastModified: 100 + n,
  version: n,
  modifiedBy: personId,
  modifiedOn: 0,
  createdBy: personId,
  createdOn: 0
})

const matchesQuery = (doc: Doc, query: DocumentQuery<Doc>): boolean =>
  Object.entries(query).every(([key, value]) => {
    const actual = Reflect.get(doc, key)
    return actual === value
  })

const makeLayer = (state: DriveState): Layer.Layer<HulyClient | HulyStorageClient> => {
  const findAll: HulyClientOperations["findAll"] = <T extends Doc>(
    classRef: Ref<Class<T>>,
    query: DocumentQuery<T>
  ) => {
    const docs = classRef === drive.class.Drive
      ? state.drives
      : classRef === drive.class.Folder
      ? state.folders
      : classRef === drive.class.File
      ? state.files
      : classRef === drive.class.FileVersion
      ? state.versions
      : []
    return Effect.succeed(
      findResult(docs.filter((doc) => matchesQuery(doc, query as DocumentQuery<Doc>)) as unknown as Array<T>)
    )
  }

  const findOne: HulyClientOperations["findOne"] = <T extends Doc>(
    classRef: Ref<Class<T>>,
    query: DocumentQuery<T>
  ) => Effect.map(findAll(classRef, query), (docs) => docs[0])

  const createDoc: HulyClientOperations["createDoc"] = <T extends Doc>(
    classRef: Ref<Class<T>>,
    space: Ref<Space>,
    attributes: Data<T>,
    id?: Ref<T>
  ) => {
    const next = id ?? toRef<T>(`created-${state.nextId++}`)
    if (classRef === drive.class.FileVersion) {
      state.versions.push({
        _id: next as unknown as Ref<FileVersion>,
        _class: drive.class.FileVersion,
        space: space as Ref<DriveSpace>,
        modifiedBy: personId,
        modifiedOn: 0,
        createdBy: personId,
        createdOn: 0,
        ...(attributes as unknown as Data<FileVersion>)
      })
    }
    return Effect.succeed(next)
  }

  const addCollection: HulyClientOperations["addCollection"] = <T extends Doc, P extends AttachedDoc>(
    classRef: Ref<Class<P>>,
    space: Ref<Space>,
    attachedTo: Ref<T>,
    attachedToClass: Ref<Class<T>>,
    _collection: string,
    attributes: AttachedData<P>,
    id?: Ref<P>
  ) => {
    const next = id ?? toRef<P>(`created-${state.nextId++}`)
    if (classRef === drive.class.FileVersion) {
      state.versions.push({
        _id: next as unknown as Ref<FileVersion>,
        _class: drive.class.FileVersion,
        space: space as Ref<DriveSpace>,
        attachedTo: attachedTo as unknown as Ref<File>,
        attachedToClass: attachedToClass as unknown as Ref<Class<File>>,
        collection: "versions",
        modifiedBy: personId,
        modifiedOn: 0,
        createdBy: personId,
        createdOn: 0,
        ...(attributes as unknown as AttachedData<FileVersion>)
      })
    }
    return Effect.succeed(next)
  }

  const updateDoc: HulyClientOperations["updateDoc"] = <T extends Doc>(
    _class: Ref<Class<T>>,
    _space: Ref<Space>,
    objectId: Ref<T>,
    operations: DocumentUpdate<T>
  ) => {
    state.updatedFile = { id: String(objectId), operations: operations as unknown as DocumentUpdate<File> }
    const targetIndex = state.files.findIndex((candidate) => String(candidate._id) === String(objectId))
    const target = state.files[targetIndex]
    if ("file" in operations) {
      state.files[targetIndex] = { ...target, file: operations.file as Ref<FileVersion> }
    }
    return Effect.succeed([])
  }

  const storage: HulyStorageOperations = {
    uploadFile: (filename, data, contentType) =>
      Effect.succeed({
        blobId: BlobId.make(`blob-${filename}`) as unknown as Ref<Blob>,
        contentType,
        size: data.length,
        url: `https://files.test/${filename}`
      }),
    getFileUrl: (blobId) => `https://files.test/${blobId}`
  }

  return Layer.merge(
    HulyClient.testLayer({
      findAll,
      findOne,
      createDoc,
      updateDoc,
      addCollection,
      workbenchUrlConfig: testWorkbenchUrlConfig
    }),
    HulyStorageClient.testLayer(storage)
  )
}

describe("drive operations", () => {
  it.effect("resolves drives by id, filters by query, and reports ambiguous names", () =>
    Effect.gen(function*() {
      const blankDrive = driveSpace("drive-4", "   ")
      const driveWithoutOwners = { ...driveSpace("drive-5", "No owners"), owners: undefined } as unknown as DriveSpace
      const state: DriveState = {
        drives: [
          driveSpace(),
          driveSpace("drive-2", "Docs"),
          driveSpace("drive-3", "Archive"),
          blankDrive,
          driveWithoutOwners
        ],
        folders: [],
        files: [],
        versions: [],
        nextId: 1
      }

      const listParams = yield* parseListDrivesParams({ query: "arc" })
      const listed = yield* listDrives(listParams).pipe(Effect.provide(makeLayer(state)))
      const getParams = yield* parseGetDriveParams({ drive: "drive-1" })
      const byId = yield* getDrive(getParams).pipe(Effect.provide(makeLayer(state)))
      const ambiguousParams = yield* parseGetDriveParams({ drive: "Docs" })
      const ambiguous = yield* Effect.flip(getDrive(ambiguousParams).pipe(Effect.provide(makeLayer(state))))
      const notFoundParams = yield* parseGetDriveParams({ drive: "Missing" })
      const notFound = yield* Effect.flip(getDrive(notFoundParams).pipe(Effect.provide(makeLayer(state))))
      const unfilteredParams = yield* parseListDrivesParams({ includeArchived: true })
      const unfiltered = yield* listDrives(unfilteredParams).pipe(Effect.provide(makeLayer(state)))

      expect(listed.drives).toMatchObject([{ name: "Archive" }])
      expect(byId.id).toBe("drive-1")
      expect(ambiguous).toBeInstanceOf(DriveIdentifierAmbiguousError)
      expect(notFound).toBeInstanceOf(DriveNotFoundError)
      expect(unfiltered.drives).toContainEqual(expect.objectContaining({ name: "(untitled)", ownersCount: 0 }))
    }))

  it.effect("lists children under a normalized folder path", () =>
    Effect.gen(function*() {
      const specs = folder("folder-specs", "Specs", drive.ids.Root)
      const api = file("file-api", "API.md", specs._id, [specs._id])
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [specs],
        files: [api],
        versions: [version("version-1", api._id, 1)],
        nextId: 1
      }

      const params = yield* parseListDriveItemsParams({ drive: "Docs", path: "Specs" })
      const result = yield* listDriveItems(params).pipe(Effect.provide(makeLayer(state)))

      expect(result.path).toBe("/Specs")
      expect(result.items).toMatchObject([{ title: "API.md", path: "/Specs/API.md", kind: "file" }])
    }))

  it.effect("fails ambiguous same-parent path matches with candidates", () =>
    Effect.gen(function*() {
      const duplicateA = folder("folder-a", "Specs", drive.ids.Root)
      const duplicateB = folder("folder-b", "Specs", drive.ids.Root)
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [duplicateA, duplicateB],
        files: [],
        versions: [],
        nextId: 1
      }

      const params = yield* parseListDriveItemsParams({ drive: "Docs", path: "/Specs" })
      const error = yield* Effect.flip(listDriveItems(params).pipe(Effect.provide(makeLayer(state))))

      expect(error).toBeInstanceOf(DrivePathAmbiguousError)
    }))

  it.effect("lists the root with default path/kind and orders same-title folder/file pairs", () =>
    Effect.gen(function*() {
      const sameFolder = folder("folder-same", "Same", drive.ids.Root)
      const sameFile = file("file-same", "Same", drive.ids.Root, [])
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [sameFolder],
        files: [sameFile],
        versions: [version("version-1", sameFile._id, 1)],
        nextId: 1
      }

      const params = yield* parseListDriveItemsParams({ drive: "Docs" })
      const result = yield* listDriveItems(params).pipe(Effect.provide(makeLayer(state)))

      expect(result.path).toBe("/")
      expect(result.items.map((item) => `${item.title}:${item.kind}`)).toEqual(["Same:file", "Same:folder"])
    }))

  it.effect("gets items by id and reports missing or non-folder path parents", () =>
    Effect.gen(function*() {
      const specs = folder("folder-specs", "Specs", drive.ids.Root)
      const api = file("file-api", "API.md", specs._id, [specs._id])
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [specs],
        files: [api],
        versions: [version("version-1", api._id, 1)],
        nextId: 1
      }

      const folderParams = yield* parseGetDriveItemParams({ drive: "Docs", itemId: "folder-specs" })
      const folderById = yield* getDriveItem(folderParams).pipe(Effect.provide(makeLayer(state)))
      const fileParams = yield* parseGetDriveItemParams({ drive: "Docs", itemId: "file-api" })
      const fileById = yield* getDriveItem(fileParams).pipe(Effect.provide(makeLayer(state)))
      const filePathParams = yield* parseGetDriveItemParams({ drive: "Docs", path: "/Specs/API.md" })
      const fileByPath = yield* getDriveItem(filePathParams).pipe(Effect.provide(makeLayer(state)))
      const missingParams = yield* parseGetDriveItemParams({ drive: "Docs", itemId: "missing" })
      const missing = yield* Effect.flip(getDriveItem(missingParams).pipe(Effect.provide(makeLayer(state))))
      const implicitRoot = yield* Effect.flip(
        getDriveItem({ drive: "Docs" } as unknown as Parameters<typeof getDriveItem>[0]).pipe(
          Effect.provide(makeLayer(state))
        )
      )
      const pathMissingParams = yield* parseListDriveItemsParams({ drive: "Docs", path: "/Missing" })
      const pathMissing = yield* Effect.flip(listDriveItems(pathMissingParams).pipe(Effect.provide(makeLayer(state))))
      const fileAsParentParams = yield* parseListDriveItemsParams({ drive: "Docs", path: "/Specs/API.md" })
      const fileAsParent = yield* Effect.flip(listDriveItems(fileAsParentParams).pipe(Effect.provide(makeLayer(state))))
      const nestedBelowFileParams = yield* parseGetDriveItemParams({ drive: "Docs", path: "/Specs/API.md/Child" })
      const nestedBelowFile = yield* Effect.flip(
        getDriveItem(nestedBelowFileParams).pipe(Effect.provide(makeLayer(state)))
      )

      expect(folderById.kind).toBe("folder")
      expect(fileById.kind).toBe("file")
      expect(fileByPath.kind).toBe("file")
      expect(missing).toBeInstanceOf(DrivePathNotFoundError)
      expect(implicitRoot).toBeInstanceOf(DrivePathNotFoundError)
      expect(pathMissing).toBeInstanceOf(DrivePathNotFoundError)
      expect(fileAsParent).toBeInstanceOf(DriveParentNotFolderError)
      expect(nestedBelowFile).toBeInstanceOf(DriveParentNotFolderError)
    }))

  it.effect("reports root get-item and folder creation conflicts", () =>
    Effect.gen(function*() {
      const duplicateA = folder("folder-a", "Specs", drive.ids.Root)
      const duplicateB = folder("folder-b", "Specs", drive.ids.Root)
      const readme = file("file-readme", "README.md", drive.ids.Root, [])
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [duplicateA, duplicateB],
        files: [readme],
        versions: [version("version-1", readme._id, 1)],
        nextId: 1
      }

      const rootParams = yield* parseGetDriveItemParams({ drive: "Docs", path: "/" })
      const root = yield* Effect.flip(getDriveItem(rootParams).pipe(Effect.provide(makeLayer(state))))
      const ambiguousFolderParams = yield* parseCreateDriveFolderParams({ drive: "Docs", path: "/Specs/Child" })
      const ambiguousFolder = yield* Effect.flip(
        createDriveFolder(ambiguousFolderParams).pipe(Effect.provide(makeLayer(state)))
      )
      const fileParentParams = yield* parseCreateDriveFolderParams({ drive: "Docs", path: "/README.md/Child" })
      const fileParent = yield* Effect.flip(createDriveFolder(fileParentParams).pipe(Effect.provide(makeLayer(state))))

      expect(root).toBeInstanceOf(DrivePathNotFoundError)
      expect(ambiguousFolder).toBeInstanceOf(DrivePathAmbiguousError)
      expect(fileParent).toBeInstanceOf(DriveParentNotFolderError)
    }))

  it.effect("creates missing folder parents and is idempotent for existing paths", () =>
    Effect.gen(function*() {
      const state: DriveState = { drives: [driveSpace()], folders: [], files: [], versions: [], nextId: 1 }

      const createParams = yield* parseCreateDriveFolderParams({ drive: "Docs", path: "/Specs/API" })
      const created = yield* createDriveFolder(createParams).pipe(Effect.provide(makeLayer(state)))
      state.folders.push(
        folder("folder-specs", "Specs", drive.ids.Root),
        folder("folder-api", "API", toRef<Folder>("folder-specs"), [toRef<Folder>("folder-specs")])
      )
      const existingParams = yield* parseCreateDriveFolderParams({ drive: "Docs", path: "/Specs" })
      const existing = yield* createDriveFolder(existingParams).pipe(Effect.provide(makeLayer(state)))

      expect(created.created).toBe(true)
      expect(created.folder.path).toBe("/Specs/API")
      expect(existing.created).toBe(false)
    }))

  it.effect("rejects root folder creation", () =>
    Effect.gen(function*() {
      const state: DriveState = { drives: [driveSpace()], folders: [], files: [], versions: [], nextId: 1 }

      const params = yield* parseCreateDriveFolderParams({ drive: "Docs", path: "/" })
      const error = yield* Effect.flip(createDriveFolder(params).pipe(Effect.provide(makeLayer(state))))

      expect(error).toBeInstanceOf(DrivePathConflictError)
    }))

  it.effect("filters item kinds and uploads with or without parent creation", () =>
    Effect.gen(function*() {
      const specs = folder("folder-specs", "Specs", drive.ids.Root)
      const api = file("file-api", "API.md", drive.ids.Root, [])
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [specs],
        files: [api],
        versions: [version("version-1", api._id, 1)],
        nextId: 1
      }

      const foldersParams = yield* parseListDriveItemsParams({ drive: "Docs", path: "/", kind: "folder" })
      const folders = yield* listDriveItems(foldersParams).pipe(Effect.provide(makeLayer(state)))
      const filesParams = yield* parseListDriveItemsParams({ drive: "Docs", path: "/", kind: "file" })
      const files = yield* listDriveItems(filesParams).pipe(Effect.provide(makeLayer(state)))
      const noParentsParams = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/Missing/Nope.txt",
        contentType: "text/plain",
        data: "SGVsbG8=",
        createParents: false
      })
      const noParents = yield* Effect.flip(uploadDriveFile(noParentsParams).pipe(Effect.provide(makeLayer(state))))
      const nestedParams = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/New/Deep/Note.txt",
        contentType: "text/plain",
        data: "SGVsbG8="
      })
      const nested = yield* uploadDriveFile(nestedParams).pipe(Effect.provide(makeLayer(state)))

      expect(folders.items).toMatchObject([{ kind: "folder", title: "Specs" }])
      expect(files.items).toMatchObject([{ kind: "file", title: "API.md" }])
      expect(noParents).toBeInstanceOf(DrivePathNotFoundError)
      expect(nested.createdParents).toMatchObject([{ path: "/New" }, { path: "/New/Deep" }])
    }))

  it.effect("uploads from a local path at the drive root and rejects root upload paths", () =>
    Effect.gen(function*() {
      const state: DriveState = { drives: [driveSpace()], folders: [], files: [], versions: [], nextId: 1 }

      const rootPathParams = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/",
        contentType: "text/plain",
        data: "SGVsbG8="
      })
      const rootPath = yield* Effect.flip(uploadDriveFile(rootPathParams).pipe(Effect.provide(makeLayer(state))))
      const filePathParams = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/README.md",
        contentType: "text/markdown",
        filePath: "README.md"
      })
      const uploaded = yield* uploadDriveFile(filePathParams).pipe(Effect.provide(makeLayer(state)))
      const fileUrlParams = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/FromUrl.txt",
        contentType: "text/plain",
        fileUrl: "ftp://example.com/file.txt"
      })
      const fileUrl = yield* Effect.flip(uploadDriveFile(fileUrlParams).pipe(Effect.provide(makeLayer(state))))
      const noSource = yield* Effect.flip(
        uploadDriveFile(
          {
            drive: "Docs",
            path: "/Empty.txt",
            contentType: "text/plain"
          } as unknown as Parameters<typeof uploadDriveFile>[0]
        ).pipe(Effect.provide(makeLayer(state)))
      )

      expect(rootPath).toBeInstanceOf(DrivePathConflictError)
      expect(uploaded.file.path).toBe("/README.md")
      expect(uploaded.createdParents).toEqual([])
      expect(fileUrl._tag).toBe("FileFetchError")
      expect(noSource._tag).toBe("InvalidFileDataError")
    }))

  it.effect("reports a folder locator when file versions require a file", () =>
    Effect.gen(function*() {
      const specs = folder("folder-specs", "Specs", drive.ids.Root)
      const state: DriveState = { drives: [driveSpace()], folders: [specs], files: [], versions: [], nextId: 1 }

      const params = yield* parseListDriveFileVersionsParams({ drive: "Docs", file: "/Specs" })
      const error = yield* Effect.flip(listDriveFileVersions(params).pipe(Effect.provide(makeLayer(state))))

      expect(error).toBeInstanceOf(DriveFileNotFoundError)
    }))

  it.effect("uploads a file, creates an initial version, and lists/restores versions", () =>
    Effect.gen(function*() {
      yield* TestClock.adjust("123 millis")
      const specs = folder("folder-specs", "Specs", drive.ids.Root)
      const state: DriveState = { drives: [driveSpace()], folders: [specs], files: [], versions: [], nextId: 1 }

      const uploadParams = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/Specs/API.md",
        contentType: "text/markdown",
        data: "SGVsbG8="
      })
      const uploaded = yield* uploadDriveFile(uploadParams).pipe(Effect.provide(makeLayer(state)))

      const createdFile = file(uploaded.file.id, "API.md", specs._id, [specs._id], uploaded.currentVersion.id)
      state.files.push(createdFile)
      state.versions.push(version("version-previous", createdFile._id, 2, "blob-previous"))

      const versionsParams = yield* parseListDriveFileVersionsParams({ drive: "Docs", file: "/Specs/API.md" })
      const versions = yield* listDriveFileVersions(versionsParams).pipe(Effect.provide(makeLayer(state)))
      const restoreParams = yield* parseRestoreDriveFileVersionParams({
        drive: "Docs",
        file: "/Specs/API.md",
        version: "version-previous"
      })
      const restored = yield* restoreDriveFileVersion(restoreParams).pipe(Effect.provide(makeLayer(state)))

      expect(uploaded.currentVersion.lastModified).toBe(123)
      expect(state.versions[0]?.file).toBe("blob-API.md")
      expect(versions.total).toBe(2)
      expect(restored.restored).toBe(true)
      expect(state.updatedFile?.operations).toMatchObject({ file: "version-previous" })
    }))

  it.effect("restores numeric versions idempotently and reports missing versions", () =>
    Effect.gen(function*() {
      const specs = folder("folder-specs", "Specs", drive.ids.Root)
      const api = file("file-api", "API.md", specs._id, [specs._id], "version-2", 2)
      const state: DriveState = {
        drives: [driveSpace()],
        folders: [specs],
        files: [api],
        versions: [version("version-1", api._id, 1), version("version-2", api._id, 2)],
        nextId: 1
      }

      const restoreParams = yield* parseRestoreDriveFileVersionParams({ drive: "Docs", file: "file-api", version: "2" })
      const restored = yield* restoreDriveFileVersion(restoreParams).pipe(Effect.provide(makeLayer(state)))
      const missingParams = yield* parseRestoreDriveFileVersionParams({ drive: "Docs", file: "file-api", version: "3" })
      const missing = yield* Effect.flip(restoreDriveFileVersion(missingParams).pipe(Effect.provide(makeLayer(state))))

      expect(restored.restored).toBe(false)
      expect(state.updatedFile).toBeUndefined()
      expect(missing).toBeInstanceOf(DriveFileVersionNotFoundError)
    }))

  it.effect("rejects upload path conflicts", () =>
    Effect.gen(function*() {
      const existing = folder("folder-specs", "Specs", drive.ids.Root)
      const state: DriveState = { drives: [driveSpace()], folders: [existing], files: [], versions: [], nextId: 1 }

      const params = yield* parseUploadDriveFileParams({
        drive: "Docs",
        path: "/Specs",
        contentType: "text/plain",
        data: "SGVsbG8="
      })
      const error = yield* Effect.flip(uploadDriveFile(params).pipe(Effect.provide(makeLayer(state))))

      expect(error).toBeInstanceOf(DrivePathConflictError)
    }))
})
