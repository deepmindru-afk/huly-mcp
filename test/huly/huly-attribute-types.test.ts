import { describe, it } from "@effect/vitest"
import { expect } from "vitest"

import {
  HULY_ATTRIBUTE_TYPE_KIND_BY_CLASS,
  hulyAttributeTypeKindFromClass,
  hulyCustomFieldTypeNameFromClass
} from "../../src/huly/huly-attribute-types.js"
import { core } from "../../src/huly/huly-plugins.js"

const expectedSdkMappings = [
  [String(core.class.TypeString), "core:class:TypeString", "string", "string"],
  [String(core.class.TypeIntlString), "core:class:TypeIntlString", "string", "string"],
  [String(core.class.TypeIdentifier), "core:class:TypeIdentifier", "string", "string"],
  [String(core.class.TypeHyperlink), "core:class:TypeHyperlink", "string", "string"],
  [String(core.class.TypeRank), "core:class:TypeRank", "string", "string"],
  [String(core.class.TypePersonId), "core:class:TypePersonId", "string", "string"],
  [String(core.class.TypeAccountUuid), "core:class:TypeAccountUuid", "string", "string"],
  [String(core.class.TypeRelation), "core:class:TypeRelation", "string", "string"],
  [String(core.class.TypeNumber), "core:class:TypeNumber", "number", "number"],
  [String(core.class.TypeFileSize), "core:class:TypeFileSize", "number", "number"],
  [String(core.class.TypeBoolean), "core:class:TypeBoolean", "boolean", "boolean"],
  [String(core.class.TypeTimestamp), "core:class:TypeTimestamp", "date", "date"],
  [String(core.class.TypeDate), "core:class:TypeDate", "date", "date"],
  [String(core.class.TypeMarkup), "core:class:TypeMarkup", "markup", "markup"],
  [String(core.class.TypeCollaborativeDoc), "core:class:TypeCollaborativeDoc", "markup", "markup"],
  [String(core.class.RefTo), "core:class:RefTo", "ref", "ref"],
  [String(core.class.EnumOf), "core:class:EnumOf", "enum", "enum"],
  [String(core.class.ArrOf), "core:class:ArrOf", "array", "array"],
  [String(core.class.Collection), "core:class:Collection", "collection", "unknown"]
] as const

describe("huly attribute type mapping", () => {
  it("maps exact real Huly SDK type class constants", () => {
    const mappedClassIds = HULY_ATTRIBUTE_TYPE_KIND_BY_CLASS.map(([classId]) => classId)

    expect(new Set(mappedClassIds).size).toBe(mappedClassIds.length)
    expect(HULY_ATTRIBUTE_TYPE_KIND_BY_CLASS).toHaveLength(expectedSdkMappings.length)

    for (const [sdkClassId, canonicalClassId, discoveryKind, customFieldType] of expectedSdkMappings) {
      expect(sdkClassId).toBe(canonicalClassId)
      expect(mappedClassIds).toContain(sdkClassId)
      expect(hulyAttributeTypeKindFromClass(sdkClassId)).toBe(discoveryKind)
      expect(hulyCustomFieldTypeNameFromClass(sdkClassId)).toBe(customFieldType)
    }
  })

  it("does not infer type families from partial class-name strings", () => {
    expect(hulyAttributeTypeKindFromClass("custom:class:TypeStringish")).toBe("unknown")
    expect(hulyCustomFieldTypeNameFromClass("custom:class:EnumOfSomething")).toBe("unknown")
  })
})
