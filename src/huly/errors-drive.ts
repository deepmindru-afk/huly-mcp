/**
 * Drive domain errors.
 *
 * @module
 */
import { Schema } from "effect"

import { NonEmptyString } from "../domain/schemas/shared.js"

const DriveAmbiguousMatchSchema = Schema.Struct({
  id: NonEmptyString,
  name: NonEmptyString
})

const PathAmbiguousCandidateSchema = Schema.Struct({
  id: NonEmptyString,
  path: NonEmptyString,
  kind: Schema.Literal("folder", "file")
})

export class DriveNotFoundError extends Schema.TaggedError<DriveNotFoundError>()(
  "DriveNotFoundError",
  { drive: NonEmptyString }
) {
  override get message(): string {
    return `Drive '${this.drive}' not found`
  }
}

export class DriveIdentifierAmbiguousError extends Schema.TaggedError<DriveIdentifierAmbiguousError>()(
  "DriveIdentifierAmbiguousError",
  {
    drive: NonEmptyString,
    matches: Schema.Array(DriveAmbiguousMatchSchema).pipe(Schema.minItems(2))
  }
) {
  override get message(): string {
    const matches = this.matches.map((match) => `${match.name} (${match.id})`).join(", ")
    return `Drive '${this.drive}' is ambiguous; use an exact drive id. Matches: ${matches}`
  }
}

export class DrivePathNotFoundError extends Schema.TaggedError<DrivePathNotFoundError>()(
  "DrivePathNotFoundError",
  {
    drive: NonEmptyString,
    path: NonEmptyString
  }
) {
  override get message(): string {
    return `Drive path '${this.path}' not found in drive '${this.drive}'`
  }
}

export class DrivePathAmbiguousError extends Schema.TaggedError<DrivePathAmbiguousError>()(
  "DrivePathAmbiguousError",
  {
    drive: NonEmptyString,
    path: NonEmptyString,
    candidates: Schema.Array(PathAmbiguousCandidateSchema).pipe(Schema.minItems(2))
  }
) {
  override get message(): string {
    const matches = this.candidates.map((candidate) => `${candidate.path} (${candidate.kind} ${candidate.id})`).join(
      ", "
    )
    return `Drive path '${this.path}' in drive '${this.drive}' is ambiguous. Matches: ${matches}`
  }
}

export class DriveParentNotFolderError extends Schema.TaggedError<DriveParentNotFolderError>()(
  "DriveParentNotFolderError",
  {
    drive: NonEmptyString,
    path: NonEmptyString,
    parentPath: NonEmptyString
  }
) {
  override get message(): string {
    return `Drive parent '${this.parentPath}' for path '${this.path}' is not a folder in drive '${this.drive}'`
  }
}

export class DriveFileNotFoundError extends Schema.TaggedError<DriveFileNotFoundError>()(
  "DriveFileNotFoundError",
  {
    drive: NonEmptyString,
    file: NonEmptyString
  }
) {
  override get message(): string {
    return `Drive file '${this.file}' not found in drive '${this.drive}'`
  }
}

export class DriveFileVersionNotFoundError extends Schema.TaggedError<DriveFileVersionNotFoundError>()(
  "DriveFileVersionNotFoundError",
  {
    drive: NonEmptyString,
    file: NonEmptyString,
    version: NonEmptyString
  }
) {
  override get message(): string {
    return `Drive file version '${this.version}' for file '${this.file}' not found in drive '${this.drive}'`
  }
}

export class DrivePathConflictError extends Schema.TaggedError<DrivePathConflictError>()(
  "DrivePathConflictError",
  {
    drive: NonEmptyString,
    path: NonEmptyString,
    existingKind: Schema.Literal("folder", "file")
  }
) {
  override get message(): string {
    return `Drive path '${this.path}' already exists as a ${this.existingKind} in drive '${this.drive}'`
  }
}
