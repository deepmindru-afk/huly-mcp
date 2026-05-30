import { JSONSchema, Schema } from "effect"

import {
  DocumentId,
  DocumentIdentifier,
  LimitParam,
  NonEmptyString,
  SavedDocumentId,
  TeamspaceIdentifier,
  Timestamp,
  UrlString
} from "./shared.js"

export const SaveDocumentParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  document: DocumentIdentifier.annotations({
    description: "Document title or ID"
  })
}).annotations({
  title: "SaveDocumentParams",
  description: "Parameters for saving/bookmarking a document"
})

export type SaveDocumentParams = Schema.Schema.Type<typeof SaveDocumentParamsSchema>

export const UnsaveDocumentParamsSchema = Schema.Struct({
  teamspace: TeamspaceIdentifier.annotations({
    description: "Teamspace name or ID"
  }),
  document: DocumentIdentifier.annotations({
    description: "Document title or ID"
  })
}).annotations({
  title: "UnsaveDocumentParams",
  description: "Parameters for removing a document from saved/bookmarks"
})

export type UnsaveDocumentParams = Schema.Schema.Type<typeof UnsaveDocumentParamsSchema>

export const ListSavedDocumentsParamsSchema = Schema.Struct({
  limit: Schema.optional(
    LimitParam.annotations({
      description:
        "Maximum number of saved-document preferences to scan before stale/inaccessible entries are skipped (default: 50)"
    })
  )
}).annotations({
  title: "ListSavedDocumentsParams",
  description: "Parameters for listing saved/bookmarked documents"
})

export type ListSavedDocumentsParams = Schema.Schema.Type<typeof ListSavedDocumentsParamsSchema>

export const SavedDocumentWireSchema = Schema.Struct({
  savedId: SavedDocumentId,
  documentId: DocumentId,
  title: NonEmptyString,
  teamspace: NonEmptyString,
  url: UrlString,
  modifiedOn: Schema.optional(Timestamp)
})

export type SavedDocumentSummary = Schema.Schema.Type<typeof SavedDocumentWireSchema>

export const SaveDocumentResultSchema = Schema.Struct({
  savedId: SavedDocumentId,
  documentId: DocumentId,
  created: Schema.Boolean
})

export type SaveDocumentResult = Schema.Schema.Type<typeof SaveDocumentResultSchema>

export const UnsaveDocumentResultSchema = Schema.Struct({
  documentId: DocumentId,
  removed: Schema.Boolean
})

export type UnsaveDocumentResult = Schema.Schema.Type<typeof UnsaveDocumentResultSchema>

export const ListSavedDocumentsResultSchema = Schema.Struct({
  documents: Schema.Array(SavedDocumentWireSchema),
  total: Schema.NonNegativeInt
})

export type ListSavedDocumentsResult = Schema.Schema.Type<typeof ListSavedDocumentsResultSchema>

export const saveDocumentParamsJsonSchema = JSONSchema.make(SaveDocumentParamsSchema)
export const unsaveDocumentParamsJsonSchema = JSONSchema.make(UnsaveDocumentParamsSchema)
export const listSavedDocumentsParamsJsonSchema = JSONSchema.make(ListSavedDocumentsParamsSchema)

export const parseSaveDocumentParams = Schema.decodeUnknown(SaveDocumentParamsSchema)
export const parseUnsaveDocumentParams = Schema.decodeUnknown(UnsaveDocumentParamsSchema)
export const parseListSavedDocumentsParams = Schema.decodeUnknown(ListSavedDocumentsParamsSchema)
