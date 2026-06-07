import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import { clearTextAsEmptyString, textContentOrClear } from "../../../src/huly/operations/clear-field-updates.js"
import { propertyTestParameters } from "../../helpers/property.js"

describe("clear field update helpers", () => {
  it("preserves non-null text for empty-string based clear policies", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(clearTextAsEmptyString(value)).toBe(value)
      }),
      propertyTestParameters
    )
  })

  it("maps null to an empty string for required text fields", () => {
    expect(clearTextAsEmptyString(null)).toBe("")
  })

  it("returns content only for non-blank text", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const result = textContentOrClear(value)

        if (value.trim() === "") {
          expect(result).toBeUndefined()
        } else {
          expect(result).toBe(value)
        }
      }),
      propertyTestParameters
    )
  })

  it("treats null as clear for content-or-clear policies", () => {
    expect(textContentOrClear(null)).toBeUndefined()
  })
})
