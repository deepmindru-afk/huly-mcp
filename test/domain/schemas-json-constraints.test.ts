import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"

import {
  addAttachmentParamsJsonSchema,
  addDocumentAttachmentParamsJsonSchema,
  addIssueAttachmentParamsJsonSchema,
  editDocumentParamsJsonSchema,
  listCardsParamsJsonSchema,
  listChannelsParamsJsonSchema,
  listDocumentsParamsJsonSchema,
  listIssuesParamsJsonSchema,
  listPersonsParamsJsonSchema,
  previewDeletionParamsJsonSchema,
  uploadFileParamsJsonSchema
} from "../../src/domain/schemas.js"

describe("cross-field JSON schema constraints", () => {
  const fileSourceAlternatives = [
    { required: ["filePath"] },
    { required: ["fileUrl"] },
    { required: ["data"] }
  ]

  it.effect("exposes file source alternatives for upload and attachment tools", () =>
    Effect.gen(function*() {
      for (
        const schema of [
          uploadFileParamsJsonSchema,
          addAttachmentParamsJsonSchema,
          addIssueAttachmentParamsJsonSchema,
          addDocumentAttachmentParamsJsonSchema
        ]
      ) {
        expect(schema).toMatchObject({
          type: "object",
          anyOf: fileSourceAlternatives
        })
      }
    }))

  it.effect("exposes mutually exclusive search filters", () =>
    Effect.gen(function*() {
      expect(listPersonsParamsJsonSchema).toMatchObject({
        allOf: [
          { not: { required: ["nameSearch", "nameRegex"] } }
        ]
      })
      expect(listChannelsParamsJsonSchema).toMatchObject({
        allOf: [
          { not: { required: ["nameSearch", "nameRegex"] } }
        ]
      })
      expect(listCardsParamsJsonSchema).toMatchObject({
        allOf: [
          { not: { required: ["titleSearch", "titleRegex"] } }
        ]
      })
      expect(listDocumentsParamsJsonSchema).toMatchObject({
        allOf: [
          { not: { required: ["titleSearch", "titleRegex"] } }
        ]
      })
    }))

  it.effect("exposes list issue cross-field exclusions", () =>
    Effect.gen(function*() {
      expect(listIssuesParamsJsonSchema).toMatchObject({
        allOf: [
          { not: { required: ["titleSearch", "titleRegex"] } },
          { not: { required: ["assignee", "hasAssignee"] } },
          { not: { required: ["component", "hasComponent"] } },
          {
            not: {
              required: ["parentIssue", "isTopLevel"],
              properties: {
                isTopLevel: { const: true }
              }
            }
          }
        ]
      })
    }))

  it.effect("exposes edit document content mode constraints", () =>
    Effect.gen(function*() {
      expect(editDocumentParamsJsonSchema).toMatchObject({
        allOf: [
          { not: { required: ["content", "old_text"] } },
          { not: { required: ["content", "new_text"] } }
        ],
        dependencies: {
          old_text: ["new_text"],
          new_text: ["old_text"]
        }
      })
    }))

  it.effect("exposes preview deletion identifier requirement for non-project targets", () =>
    Effect.gen(function*() {
      expect(previewDeletionParamsJsonSchema).toMatchObject({
        allOf: [
          {
            if: {
              required: ["entityType"],
              properties: {
                entityType: { enum: ["issue", "component", "milestone"] }
              }
            },
            then: { required: ["identifier"] }
          }
        ]
      })
    }))
})
