import { describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { expect } from "vitest"

import {
  ActivityMessageWireSchema,
  AddReactionResultSchema,
  CreateWorkSlotResultSchema,
  CreateWorkspaceResultSchema,
  ListMentionsResultSchema,
  ListReactionsResultSchema,
  ListSavedDocumentsResultSchema,
  ListSavedMessagesResultSchema,
  LogTimeResultSchema,
  SavedDocumentWireSchema,
  SaveDocumentResultSchema,
  SaveMessageResultSchema,
  StopTimerResultSchema,
  TimeSpendReportWireSchema,
  UnsaveDocumentResultSchema,
  WorkSlotWireSchema,
  WorkspaceInfoSchema,
  WorkspaceMemberSchema
} from "../../src/domain/schemas.js"

describe("branded output schemas", () => {
  it.effect("keeps time output payloads JSON-compatible while validating branded IDs", () =>
    Effect.gen(function*() {
      const report = yield* Schema.decodeUnknown(TimeSpendReportWireSchema)({
        id: "report-1",
        identifier: "HULY-1",
        employee: "Alice",
        date: 1700000000000,
        value: 30,
        description: "Implementation"
      })
      const slot = yield* Schema.decodeUnknown(WorkSlotWireSchema)({
        id: "slot-1",
        todoId: "todo-1",
        date: 1700000000000,
        dueDate: 1700003600000,
        title: "Focus"
      })
      const logged = yield* Schema.decodeUnknown(LogTimeResultSchema)({
        reportId: "report-2",
        identifier: "HULY-2"
      })
      const createdSlot = yield* Schema.decodeUnknown(CreateWorkSlotResultSchema)({
        slotId: "slot-2"
      })
      const stopped = yield* Schema.decodeUnknown(StopTimerResultSchema)({
        identifier: "HULY-3",
        stoppedAt: 1700000000000,
        reportId: "report-3"
      })

      expect(report.id).toBe("report-1")
      expect(slot.id).toBe("slot-1")
      expect(logged.reportId).toBe("report-2")
      expect(createdSlot.slotId).toBe("slot-2")
      expect(stopped.reportId).toBe("report-3")
    }))

  it.effect("keeps workspace output payloads JSON-compatible while validating branded IDs", () =>
    Effect.gen(function*() {
      const member = yield* Schema.decodeUnknown(WorkspaceMemberSchema)({
        personId: "person-uuid-1",
        role: "OWNER",
        name: "Alice",
        email: "alice@example.test"
      })
      const workspace = yield* Schema.decodeUnknown(WorkspaceInfoSchema)({
        uuid: "workspace-uuid-1",
        name: "Product",
        url: "product",
        region: "us-east",
        createdOn: 1700000000000,
        allowReadOnlyGuest: true,
        allowGuestSignUp: false,
        version: "1.2.3",
        mode: "active"
      })
      const created = yield* Schema.decodeUnknown(CreateWorkspaceResultSchema)({
        uuid: "workspace-uuid-2",
        url: "new-product",
        name: "New Product"
      })

      expect(member.personId).toBe("person-uuid-1")
      expect(workspace.uuid).toBe("workspace-uuid-1")
      expect(workspace.region).toBe("us-east")
      expect(created.uuid).toBe("workspace-uuid-2")
      expect(created.url).toBe("new-product")
    }))

  it.effect("keeps activity output payloads JSON-compatible while validating branded IDs", () =>
    Effect.gen(function*() {
      const messagePayload = {
        id: "activity-1",
        objectId: "issue-1",
        objectClass: "tracker:class:Issue",
        modifiedBy: "person-1",
        modifiedOn: 1700000000000,
        isPinned: false,
        replies: 1,
        reactions: 2,
        editedOn: null,
        action: "update",
        message: "Changed priority"
      }
      const message = yield* Schema.decodeUnknown(ActivityMessageWireSchema)(messagePayload)
      const encodedMessage = yield* Schema.encodeUnknown(ActivityMessageWireSchema)(message)
      const reactionPayloads = [
        {
          id: "reaction-1",
          messageId: "activity-1",
          emoji: ":thumbsup:",
          createdBy: "person-1"
        }
      ]
      const reactions = yield* Schema.decodeUnknown(ListReactionsResultSchema)(reactionPayloads)
      const encodedReactions = yield* Schema.encodeUnknown(ListReactionsResultSchema)(reactions)
      const savedPayloads = [
        {
          id: "saved-1",
          messageId: "activity-1"
        }
      ]
      const saved = yield* Schema.decodeUnknown(ListSavedMessagesResultSchema)(savedPayloads)
      const encodedSaved = yield* Schema.encodeUnknown(ListSavedMessagesResultSchema)(saved)
      const mentionPayloads = [
        {
          id: "mention-1",
          messageId: "activity-1",
          userId: "person-2",
          content: "Please review"
        }
      ]
      const mentions = yield* Schema.decodeUnknown(ListMentionsResultSchema)(mentionPayloads)
      const encodedMentions = yield* Schema.encodeUnknown(ListMentionsResultSchema)(mentions)
      const addReactionPayload = {
        reactionId: "reaction-2",
        messageId: "activity-1"
      }
      const added = yield* Schema.decodeUnknown(AddReactionResultSchema)(addReactionPayload)
      const encodedAdded = yield* Schema.encodeUnknown(AddReactionResultSchema)(added)
      const saveMessagePayload = {
        savedId: "saved-2",
        messageId: "activity-1"
      }
      const savedResult = yield* Schema.decodeUnknown(SaveMessageResultSchema)(saveMessagePayload)
      const encodedSavedResult = yield* Schema.encodeUnknown(SaveMessageResultSchema)(savedResult)

      expect(message.id).toBe("activity-1")
      expect(message.objectId).toBe("issue-1")
      expect(encodedMessage).toEqual(messagePayload)
      expect(reactions[0]?.id).toBe("reaction-1")
      expect(encodedReactions).toEqual(reactionPayloads)
      expect(saved[0]?.id).toBe("saved-1")
      expect(encodedSaved).toEqual(savedPayloads)
      expect(mentions[0]?.userId).toBe("person-2")
      expect(encodedMentions).toEqual(mentionPayloads)
      expect(added.reactionId).toBe("reaction-2")
      expect(encodedAdded).toEqual(addReactionPayload)
      expect(savedResult.savedId).toBe("saved-2")
      expect(encodedSavedResult).toEqual(saveMessagePayload)
    }))

  it.effect("keeps document saved-output payloads JSON-compatible while validating branded IDs", () =>
    Effect.gen(function*() {
      const savedDocumentPayload = {
        savedId: "saved-doc-1",
        documentId: "doc-1",
        title: "Design Notes",
        teamspace: "My Docs",
        url: "https://huly.example/workbench/docs/doc-1",
        modifiedOn: 1700000000000
      }
      const savedDocument = yield* Schema.decodeUnknown(SavedDocumentWireSchema)(savedDocumentPayload)
      const encodedSavedDocument = yield* Schema.encodeUnknown(SavedDocumentWireSchema)(savedDocument)
      const saveResultPayload = {
        savedId: "saved-doc-2",
        documentId: "doc-2",
        created: true
      }
      const saveResult = yield* Schema.decodeUnknown(SaveDocumentResultSchema)(saveResultPayload)
      const encodedSaveResult = yield* Schema.encodeUnknown(SaveDocumentResultSchema)(saveResult)
      const unsaveResultPayload = {
        documentId: "doc-2",
        removed: false
      }
      const unsaveResult = yield* Schema.decodeUnknown(UnsaveDocumentResultSchema)(unsaveResultPayload)
      const encodedUnsaveResult = yield* Schema.encodeUnknown(UnsaveDocumentResultSchema)(unsaveResult)
      const listPayload = {
        documents: [savedDocumentPayload],
        total: 1
      }
      const listResult = yield* Schema.decodeUnknown(ListSavedDocumentsResultSchema)(listPayload)
      const encodedListResult = yield* Schema.encodeUnknown(ListSavedDocumentsResultSchema)(listResult)

      expect(savedDocument.savedId).toBe("saved-doc-1")
      expect(savedDocument.documentId).toBe("doc-1")
      expect(encodedSavedDocument).toEqual(savedDocumentPayload)
      expect(saveResult.savedId).toBe("saved-doc-2")
      expect(encodedSaveResult).toEqual(saveResultPayload)
      expect(unsaveResult.documentId).toBe("doc-2")
      expect(encodedUnsaveResult).toEqual(unsaveResultPayload)
      expect(listResult.documents[0]?.documentId).toBe("doc-1")
      expect(encodedListResult).toEqual(listPayload)
    }))

  it.effect("rejects blank saved-document titles and teamspace names", () =>
    Effect.gen(function*() {
      const blankTitle = yield* Effect.flip(
        Schema.decodeUnknown(SavedDocumentWireSchema)({
          savedId: "saved-doc-1",
          documentId: "doc-1",
          title: "  ",
          teamspace: "My Docs",
          url: "https://huly.example/workbench/docs/doc-1"
        })
      )
      const blankTeamspace = yield* Effect.flip(
        Schema.decodeUnknown(ListSavedDocumentsResultSchema)({
          documents: [{
            savedId: "saved-doc-1",
            documentId: "doc-1",
            title: "Design Notes",
            teamspace: "  ",
            url: "https://huly.example/workbench/docs/doc-1"
          }],
          total: 1
        })
      )

      expect(blankTitle._tag).toBe("ParseError")
      expect(blankTeamspace._tag).toBe("ParseError")
    }))
})
