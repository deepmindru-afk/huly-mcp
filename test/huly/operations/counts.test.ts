import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import { UNKNOWN_TOTAL } from "../../../src/domain/schemas/shared.js"
import { listTotal, optionalCount } from "../../../src/huly/operations/counts.js"
import { propertyTestParameters } from "../../helpers/property.js"

const countValueArbitrary = fc.integer({ min: 0, max: 1_000_000 })
const invalidNegativeCountArbitrary = fc.integer({ min: -1_000_000, max: -1 })
const invalidListTotalNegativeArbitrary = fc.integer({ min: -1_000_000, max: -2 })
const fractionalValueArbitrary = fc.double({
  min: -1_000_000,
  max: 1_000_000,
  noDefaultInfinity: true,
  noNaN: true
}).filter((value) => !Number.isInteger(value))

describe("count helpers", () => {
  it("preserves only the explicit unknown total sentinel", () => {
    expect(listTotal(0)).toBe(0)
    expect(listTotal(3)).toBe(3)
    expect(listTotal(UNKNOWN_TOTAL)).toBe(UNKNOWN_TOTAL)
    expect(() => listTotal(-2)).toThrow()
  })

  it("validates optional counts when present", () => {
    expect(optionalCount(undefined)).toBeUndefined()
    expect(optionalCount(2)).toBe(2)
    expect(() => optionalCount(-1)).toThrow()
  })

  it("preserves generated non-negative integer counts", () => {
    fc.assert(
      fc.property(countValueArbitrary, (value) => {
        expect(listTotal(value)).toBe(value)
        expect(optionalCount(value)).toBe(value)
      }),
      propertyTestParameters
    )
  })

  it("rejects generated invalid count values", () => {
    fc.assert(
      fc.property(invalidNegativeCountArbitrary, (value) => {
        expect(() => optionalCount(value)).toThrow()
      }),
      propertyTestParameters
    )

    fc.assert(
      fc.property(invalidListTotalNegativeArbitrary, (value) => {
        expect(() => listTotal(value)).toThrow()
      }),
      propertyTestParameters
    )

    fc.assert(
      fc.property(fractionalValueArbitrary, (value) => {
        expect(() => listTotal(value)).toThrow()
        expect(() => optionalCount(value)).toThrow()
      }),
      propertyTestParameters
    )
  })
})
