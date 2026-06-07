import { Schema } from "effect"

export const clearableText = (description: string) =>
  Schema.NullOr(Schema.String).annotations({
    description: `${description} Pass null to clear; empty string is also accepted.`
  })
