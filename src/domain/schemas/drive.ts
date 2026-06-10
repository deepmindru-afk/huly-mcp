import { JSONSchema, Schema } from "effect"

import {
  BlobId,
  Count,
  DEFAULT_INCLUDE_ARCHIVED,
  DEFAULT_LIMIT,
  DocId,
  hasAtLeastOneDefined,
  hasMutuallyExclusiveFields,
  LimitParam,
  MimeType,
  mutuallyExclusiveFieldsMessage,
  NonEmptyString,
  Timestamp,
  UrlString,
  withAtLeastOneRequired,
  withMutuallyExclusiveFields
} from "./shared.js"

const limitDescription = (subject: string): string => `Maximum ${subject} to return (default: ${DEFAULT_LIMIT}).`
export const DEFAULT_DRIVE_PATH = "/"
export const DEFAULT_DRIVE_ITEM_KIND = "any"
export const DEFAULT_DRIVE_CREATE_PARENTS = true

export const DriveId = DocId.pipe(Schema.brand("DriveId"))
export type DriveId = Schema.Schema.Type<typeof DriveId>

export const DriveItemId = DocId.pipe(Schema.brand("DriveItemId"))
export type DriveItemId = Schema.Schema.Type<typeof DriveItemId>

export const DriveFileVersionId = DocId.pipe(Schema.brand("DriveFileVersionId"))
export type DriveFileVersionId = Schema.Schema.Type<typeof DriveFileVersionId>

export const DriveIdentifier = NonEmptyString.pipe(Schema.brand("DriveIdentifier")).annotations({
  description: "Exact Drive id or exact Drive name. Use list_drives first when unsure."
})
export type DriveIdentifier = Schema.Schema.Type<typeof DriveIdentifier>

export const DrivePath = NonEmptyString.pipe(Schema.brand("DrivePath")).annotations({
  description:
    "POSIX-like Drive path. Absolute paths such as '/Specs/API.md' are preferred; relative paths are normalized under '/'."
})
export type DrivePath = Schema.Schema.Type<typeof DrivePath>

const DriveFileLocator = NonEmptyString.pipe(Schema.brand("DriveFileLocator")).annotations({
  description: "Drive file id or Drive file path."
})

const DriveVersionLocator = NonEmptyString.pipe(Schema.brand("DriveVersionLocator")).annotations({
  description: "Drive file version id or numeric version string such as '1'."
})

export const DriveItemKindSchema = Schema.Literal("any", "folder", "file")
export type DriveItemKind = Schema.Schema.Type<typeof DriveItemKindSchema>

export const DriveSummarySchema = Schema.Struct({
  id: DriveId,
  name: NonEmptyString,
  description: Schema.optional(Schema.String),
  archived: Schema.Boolean,
  private: Schema.Boolean,
  membersCount: Count,
  ownersCount: Count,
  url: UrlString
})
export type DriveSummary = Schema.Schema.Type<typeof DriveSummarySchema>

export const DriveItemSummarySchema = Schema.Struct({
  id: DriveItemId,
  driveId: DriveId,
  kind: Schema.Literal("folder", "file"),
  title: NonEmptyString,
  path: DrivePath,
  parentId: Schema.optional(DriveItemId),
  url: UrlString,
  currentVersionId: Schema.optional(DriveFileVersionId),
  version: Schema.optional(Count),
  size: Schema.optional(Count),
  contentType: Schema.optional(MimeType),
  downloadUrl: Schema.optional(UrlString)
})
export type DriveItemSummary = Schema.Schema.Type<typeof DriveItemSummarySchema>

export const DriveFileVersionSummarySchema = Schema.Struct({
  id: DriveFileVersionId,
  fileId: DriveItemId,
  version: Count,
  title: NonEmptyString,
  blobId: BlobId,
  size: Count,
  contentType: MimeType,
  lastModified: Timestamp,
  current: Schema.Boolean,
  downloadUrl: UrlString
})
export type DriveFileVersionSummary = Schema.Schema.Type<typeof DriveFileVersionSummarySchema>

export const ListDrivesResultSchema = Schema.Struct({
  drives: Schema.Array(DriveSummarySchema),
  total: Count
})
export type ListDrivesResult = Schema.Schema.Type<typeof ListDrivesResultSchema>

export const ListDriveItemsResultSchema = Schema.Struct({
  drive: DriveSummarySchema,
  path: DrivePath,
  items: Schema.Array(DriveItemSummarySchema),
  total: Count
})
export type ListDriveItemsResult = Schema.Schema.Type<typeof ListDriveItemsResultSchema>

export const CreateDriveFolderResultSchema = Schema.Struct({
  folder: DriveItemSummarySchema,
  created: Schema.Boolean
})
export type CreateDriveFolderResult = Schema.Schema.Type<typeof CreateDriveFolderResultSchema>

export const UploadDriveFileResultSchema = Schema.Struct({
  file: DriveItemSummarySchema,
  createdParents: Schema.Array(DriveItemSummarySchema),
  currentVersion: DriveFileVersionSummarySchema
})
export type UploadDriveFileResult = Schema.Schema.Type<typeof UploadDriveFileResultSchema>

export const ListDriveFileVersionsResultSchema = Schema.Struct({
  file: DriveItemSummarySchema,
  versions: Schema.Array(DriveFileVersionSummarySchema),
  total: Count
})
export type ListDriveFileVersionsResult = Schema.Schema.Type<typeof ListDriveFileVersionsResultSchema>

export const RestoreDriveFileVersionResultSchema = Schema.Struct({
  file: DriveItemSummarySchema,
  restoredVersion: DriveFileVersionSummarySchema,
  restored: Schema.Boolean
})
export type RestoreDriveFileVersionResult = Schema.Schema.Type<typeof RestoreDriveFileVersionResultSchema>

export const ListDrivesParamsSchema = Schema.Struct({
  query: Schema.optional(NonEmptyString.annotations({
    description: "Case-insensitive substring to filter Drive names after listing."
  })),
  includeArchived: Schema.optional(Schema.Boolean.annotations({
    description: `Include archived Drives. Defaults to ${DEFAULT_INCLUDE_ARCHIVED}.`
  })),
  limit: Schema.optional(LimitParam.annotations({ description: limitDescription("drives") }))
})
export type ListDrivesParams = Schema.Schema.Type<typeof ListDrivesParamsSchema>

export const GetDriveParamsSchema = Schema.Struct({
  drive: DriveIdentifier
})
export type GetDriveParams = Schema.Schema.Type<typeof GetDriveParamsSchema>

export const ListDriveItemsParamsSchema = Schema.Struct({
  drive: DriveIdentifier,
  path: Schema.optional(
    DrivePath.annotations({ description: `Folder path to list. Defaults to ${DEFAULT_DRIVE_PATH}.` })
  ),
  kind: Schema.optional(DriveItemKindSchema.annotations({
    description: `Filter returned children by kind. Defaults to ${DEFAULT_DRIVE_ITEM_KIND}.`
  })),
  limit: Schema.optional(LimitParam.annotations({ description: limitDescription("drive items") }))
})
export type ListDriveItemsParams = Schema.Schema.Type<typeof ListDriveItemsParamsSchema>

export const GetDriveItemParamsSchema = Schema.Struct({
  drive: DriveIdentifier,
  path: Schema.optional(DrivePath),
  itemId: Schema.optional(DriveItemId.annotations({
    description: "Exact Drive folder or file id. Mutually exclusive with path."
  }))
}).pipe(
  Schema.filter((params) => hasAtLeastOneDefined(params, ["path", "itemId"]) || "Provide path or itemId."),
  Schema.filter((params) =>
    !hasMutuallyExclusiveFields(params, ["path", "itemId"]) || mutuallyExclusiveFieldsMessage(["path", "itemId"])
  )
)
export type GetDriveItemParams = Schema.Schema.Type<typeof GetDriveItemParamsSchema>

export const CreateDriveFolderParamsSchema = Schema.Struct({
  drive: DriveIdentifier,
  path: DrivePath.annotations({
    description: "Folder path to create. Missing parents are created, like mkdir -p."
  })
})
export type CreateDriveFolderParams = Schema.Schema.Type<typeof CreateDriveFolderParamsSchema>

const UploadSourceFields = {
  filePath: Schema.optional(Schema.String.annotations({
    description: "Local filesystem path to upload. Preferred for large files."
  })),
  fileUrl: Schema.optional(Schema.String.annotations({
    description: "Remote URL to fetch server-side."
  })),
  data: Schema.optional(Schema.String.annotations({
    description: "Base64-encoded file content. Use only for small files."
  }))
} as const

const hasExactlyOneUploadSource = (params: {
  readonly filePath?: string | undefined
  readonly fileUrl?: string | undefined
  readonly data?: string | undefined
}): boolean | string => {
  const count = [params.filePath, params.fileUrl, params.data].filter((value) => value !== undefined).length
  return count === 1 ? true : "Provide exactly one of filePath, fileUrl, or data."
}

export const UploadDriveFileParamsSchema = Schema.Struct({
  drive: DriveIdentifier,
  path: DrivePath.annotations({
    description: "Full Drive file path including filename, for example '/Specs/API.md'."
  }),
  contentType: MimeType.annotations({
    description: "MIME type of the file, for example 'text/plain' or 'application/pdf'."
  }),
  createParents: Schema.optional(Schema.Boolean.annotations({
    description: `Create missing parent folders automatically. Defaults to ${DEFAULT_DRIVE_CREATE_PARENTS}.`
  })),
  ...UploadSourceFields
}).pipe(Schema.filter(hasExactlyOneUploadSource))
export type UploadDriveFileParams = Schema.Schema.Type<typeof UploadDriveFileParamsSchema>

export const ListDriveFileVersionsParamsSchema = Schema.Struct({
  drive: DriveIdentifier,
  file: DriveFileLocator
})
export type ListDriveFileVersionsParams = Schema.Schema.Type<typeof ListDriveFileVersionsParamsSchema>

export const RestoreDriveFileVersionParamsSchema = Schema.Struct({
  drive: DriveIdentifier,
  file: DriveFileLocator,
  version: DriveVersionLocator
})
export type RestoreDriveFileVersionParams = Schema.Schema.Type<typeof RestoreDriveFileVersionParamsSchema>

export const listDrivesParamsJsonSchema = JSONSchema.make(ListDrivesParamsSchema)
export const getDriveParamsJsonSchema = JSONSchema.make(GetDriveParamsSchema)
export const listDriveItemsParamsJsonSchema = JSONSchema.make(ListDriveItemsParamsSchema)
export const getDriveItemParamsJsonSchema = withAtLeastOneRequired(
  withMutuallyExclusiveFields(JSONSchema.make(GetDriveItemParamsSchema), ["path", "itemId"]),
  ["path", "itemId"]
)
export const createDriveFolderParamsJsonSchema = JSONSchema.make(CreateDriveFolderParamsSchema)
export const uploadDriveFileParamsJsonSchema = {
  ...JSONSchema.make(UploadDriveFileParamsSchema),
  oneOf: [{ required: ["filePath"] }, { required: ["fileUrl"] }, { required: ["data"] }]
}
export const listDriveFileVersionsParamsJsonSchema = JSONSchema.make(ListDriveFileVersionsParamsSchema)
export const restoreDriveFileVersionParamsJsonSchema = JSONSchema.make(RestoreDriveFileVersionParamsSchema)

export const parseListDrivesParams = Schema.decodeUnknown(ListDrivesParamsSchema)
export const parseGetDriveParams = Schema.decodeUnknown(GetDriveParamsSchema)
export const parseListDriveItemsParams = Schema.decodeUnknown(ListDriveItemsParamsSchema)
export const parseGetDriveItemParams = Schema.decodeUnknown(GetDriveItemParamsSchema)
export const parseCreateDriveFolderParams = Schema.decodeUnknown(CreateDriveFolderParamsSchema)
export const parseUploadDriveFileParams = Schema.decodeUnknown(UploadDriveFileParamsSchema)
export const parseListDriveFileVersionsParams = Schema.decodeUnknown(ListDriveFileVersionsParamsSchema)
export const parseRestoreDriveFileVersionParams = Schema.decodeUnknown(RestoreDriveFileVersionParamsSchema)
