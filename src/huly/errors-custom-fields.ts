/**
 * Custom field domain errors.
 *
 * @module
 */
import { Schema } from "effect"

import { DocId, ObjectClassName } from "../domain/schemas/shared.js"

export class CustomFieldNotFoundError extends Schema.TaggedError<CustomFieldNotFoundError>()(
  "CustomFieldNotFoundError",
  {
    identifier: Schema.String
  }
) {
  override get message(): string {
    return `Custom field '${this.identifier}' not found`
  }
}

export class CustomFieldObjectNotFoundError extends Schema.TaggedError<CustomFieldObjectNotFoundError>()(
  "CustomFieldObjectNotFoundError",
  {
    objectId: DocId,
    objectClass: ObjectClassName
  }
) {
  override get message(): string {
    return `Object '${this.objectId}' of class '${this.objectClass}' not found`
  }
}
