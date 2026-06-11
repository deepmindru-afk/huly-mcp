# Issue 99: Chat, Channel, Applet, Email, Telegram, And Mail Pre-Plan

Source issue: https://github.com/dearlordylord/huly-mcp/issues/99

Status: researched and ready to split into implementation PRs.

## Current Coverage Baseline

The issue body has a corrected coverage section, and the current tree agrees with it:

- Channel CRUD is implemented in `src/huly/operations/channels.ts`.
- Channel message list/send/update/delete is implemented through `channels.ts` and `channels-messages.ts`.
- One-to-one DM list/create and DM message list/send/update/delete are implemented in `direct-messages.ts`.
- Thread reply list/add/update/delete is implemented in `threads.ts`.
- Generic space member mutation already exists in `spaces-write.ts`, but it is not a channel-specific, LLM-first API.
- Notification contexts already expose pin/hide/archive by context ID, but there is no channel/DM friendly resolver for "star this channel" or "close this conversation".
- Activity tools already cover generic pinned activity messages; chat-specific pinned-message workflows need friendly channel/DM message locators.

## Upstream Findings

Chunter core is stable enough for a first implementation slice:

- `Channel` and `DirectMessage` are `Space` subclasses with `members`, `owners`, `private`, and `archived` inherited from core `Space`.
- `ChatMessage` carries `message`, optional `attachments`, optional `editedOn`, and optional provider metadata.
- Upstream one-to-one DM creation sorts the two account UUID members before creating a private `DirectMessage`.
- Upstream group DM creation in chunter resources generalizes this: include current employee, map employees to account UUIDs, compare by exact member set, create `DirectMessage` with all unique accounts, then create or unhide a `DocNotifyContext`.
- Channel join/leave uses `$push` / `$pull` on `members`. The MCP code can also use full sorted replacement as the existing generic `spaces` code does, but channel-specific tests should prove idempotence.
- Stars/favorites and close/reopen are not fields on channels. They are per-user `notification.class.DocNotifyContext` mutations: `isPinned` for star/unstar and `hidden` for close/reopen.
- Pinned chat messages are activity-message `isPinned` state, with channel-specific lookup across `ChatMessage`, `ThreadMessage`, and `ActivityReference` in the UI.

Integration/plugin areas are not ready for broad write tools in the same PR:

- Communication applets/polls expose `Applet`, `Poll`, `PollAnswer`, `CustomActivityPresenter`, and `GuestCommunicationSettings`, but the user-facing creation flow depends on applet resources and card/message contracts.
- Gmail and Telegram expose plugin-specific message, queued-message, shared-message, attachment count, and send-status records, but those packages are not installed in `package.json`.
- Huly Mail in the platform fork is tag/card based (`mail.tag.MailThread` on `chat.masterTag.Thread`) and the worker creates cards/messages through communication events. This needs a spike before MCP write tools.

## Recommended First PR Boundary

Implement **core chat/channel lifecycle and membership only**:

1. Channel member list/add/remove.
2. Join and leave channel wrappers for the authenticated account.
3. Archive/unarchive channel wrappers.
4. Group direct-message create/open.
5. Conversation star/unstar and close/reopen by channel or DM locator, backed by `DocNotifyContext`.

Do not include Gmail, Telegram, Mail, applets, polls, translation, or attachments in the first PR.

Reason: the first PR uses installed typed SDK packages (`@hcengineering/chunter`, `@hcengineering/notification`, `@hcengineering/contact`) and existing MCP patterns. The plugin integration work needs either new dependencies or raw class IDs, which would violate the LLM-first API principle if rushed.

## API Shape

Add these tools to the `channels` category:

- `list_channel_members`
  - Params: `channel`
  - Returns: channel id/name plus members as account UUID, display name when available, and maybe email if resolver support is cheap.

- `add_channel_members`
  - Params: `channel`, `members: NonEmptyArray<PersonRefInput | AccountUuid>`
  - Returns: channel id, full current member list, added count, changed boolean.

- `remove_channel_members`
  - Params: `channel`, `members`
  - Returns: channel id, full current member list, removed count, changed boolean.

- `join_channel`
  - Params: `channel`
  - Returns: channel id, account UUID, changed boolean.

- `leave_channel`
  - Params: `channel`
  - Returns: channel id, account UUID, changed boolean.
  - Guard: do not remove the final member without explicit evidence that Huly supports an empty channel safely.

- `archive_channel` / `unarchive_channel`
  - Params: `channel`
  - Returns: channel id, archived boolean, changed boolean.
  - Keep `delete_channel` as permanent deletion and update its description to point callers to archive first when they want reversible behavior.

- `create_group_direct_message`
  - Params: `people: NonEmptyArray<PersonRefInput | AccountUuid>`, optional `reuseExisting: boolean = true`
  - Behavior: include authenticated account automatically, resolve all people, reject self-only, unique/sort accounts, exact-set match existing `DirectMessage`, otherwise create.
  - Returns: dm id, participant names/account UUIDs, created boolean.

- `set_conversation_starred`
  - Params: exactly one of `channel` or `dm`, `starred: boolean`
  - Behavior: resolve object, find or create current-user `DocNotifyContext`, update `isPinned`.
  - Returns: context id, object id/class, starred boolean, changed boolean.

- `set_conversation_closed`
  - Params: exactly one of `channel` or `dm`, `closed: boolean`
  - Behavior: same context resolver, map `closed` to `hidden`.
  - Returns: context id, object id/class, closed boolean, changed boolean.

Use `set_*` names where a single idempotent tool is clearer for LLM callers than separate verbs. Add convenience aliases only if registry conventions require verb prefixes.

## Type And Module Design

Add new branded/shared schemas rather than widening existing string types:

- `ConversationIdentifier` only if it can be precisely documented; otherwise keep separate `ChannelIdentifier` and `DirectMessageIdentifier`.
- `ChannelMemberIdentifier` should be a union of `AccountUuid` and `PersonRefInput`, with descriptions saying email, exact display name, or account UUID.
- `ConversationObjectClass` should be a literal schema if exposed in outputs, not an arbitrary string.

Avoid growing large files further:

- Move membership operations to `src/huly/operations/channel-members.ts`.
- Move group DM lifecycle and shared DM-member helpers to `src/huly/operations/direct-message-conversations.ts` or split `direct-messages.ts`.
- Move conversation context resolution to `src/huly/operations/chat-contexts.ts`.
- Add schemas in either `src/domain/schemas/channel-members.ts` and `chat-conversations.ts`, or split the existing channel schemas if export churn stays manageable.
- Keep `src/mcp/tools/channels.ts` as the registration point, but imports should remain thin.

Use `StrictDocumentQuery<T>` and `hulyQuery<T>()` for all new `findAll` / `findOne` query object literals. Do not introduce untyped string-key Huly queries.

Type casts should stay at SDK-boundary helpers only. If unavoidable for Huly phantom brands, document the exact erased-runtime equivalence beside the cast, matching the existing `personIdsAsSocialIdentityRefs` style.

## Error Model

Add targeted errors in `errors-messaging.ts`:

- `ChannelMemberNotFoundError` if a provided member does not resolve to an employee/account.
- `CannotRemoveLastChannelMemberError` if leave/remove would empty the channel.
- `CannotCreateDirectMessageWithoutParticipantsError` for self-only or empty group DM after de-dupe.
- Reuse `DirectMessageIdentifierAmbiguousError` and `DirectMessageNotFoundError` for DM lookup.

Expose ambiguity with enough data for an LLM to retry in one call where possible: include count and candidate ids/names when practical.

## Tests

Unit/schema tests:

- Decode/reject all new schemas, including mutually-exclusive `channel`/`dm`, non-empty member arrays, UUID-vs-name/email inputs, and update-field requirements.
- Operation tests with `HulyClient.testLayer`, no `vi.mock`/`spyOn`/module patching.
- Member resolution tests: account UUID direct, email, display name, ambiguous person, non-employee person.
- Idempotence: adding existing members, removing absent members, join when already joined, leave when absent, archive already archived, star already starred, close already hidden.
- Group DM exact-set matching independent of input order and duplicate people.
- Context creation/unhide for group DM and star/close operations.

Integration tests:

- Required for the first PR because it adds feature surface.
- Run local Huly with the documented container URL override:
  `pnpm build && set -a && source .env.local && set +a && HULY_URL="${HULY_URL/localhost/host.docker.internal}" bash scripts/integration_test_full.sh`
- Add focused integration coverage for member add/remove and group DM creation if the script does not already exercise them.

Quality gate:

- `pnpm check-all`
- No new ordinary `*.test.ts` imports from `fast-check`; property tests must stay in `*.property.test.ts`.
- Watch max-lines failures. Split modules by responsibility instead of compressing code.

## Later PRs

Second PR: chat message UX helpers.

- Chat-specific pin/unpin/list pinned messages by channel or DM.
- Message attachments for channel and DM sends, reusing generic attachment/storage tools where possible.
- Translation should remain a spike until the translate service/event contract is available from installed packages or integration tests.

Third PR: communication applet and poll spike.

- Read-only discovery first: list applet types/poll cards/answers if stable.
- Only add create/answer tools after proving whether applet `createFn` is callable server-side or whether MCP should create card/message records directly.

Fourth PR: email/Gmail/Telegram/Mail spike.

- Do not add raw plugin dependencies blindly. First decide whether to add installed package dependencies or use typed local interfaces plus class IDs.
- Prefer read/list status tools before compose/send.
- For Mail, model it as card/thread/tag behavior only after proving stable `chat.masterTag.Thread` and `mail.tag.MailThread` creation from MCP without Kafka worker-only behavior.

## Open Questions Before Implementation

- Should channel member add/remove use full sorted replacement, like generic spaces, or `$push`/`$pull`, like upstream chunter resources? Full replacement is easier to test idempotently; `$push`/`$pull` is closer to UI behavior.
- When closing a channel conversation, should MCP also leave the channel for `Channel` objects? Upstream `removeChannelAction` leaves for channels but hides context for non-channel activity. I recommend separate tools: `leave_channel` mutates membership; `set_conversation_closed` mutates visibility only.
- Should group DMs allow two people plus current user only, or any group size? Upstream supports any size after de-dupe.
- Should archived channels reject send/update/member mutations? Existing code allows operations if the channel resolves by ID. Decide explicitly and integration-test the chosen behavior.

