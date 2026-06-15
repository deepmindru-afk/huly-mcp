export interface McpInputSchema {
  readonly type: "object"
  readonly properties?: Record<string, unknown>
  readonly required?: ReadonlyArray<string>
  readonly $defs?: Record<string, unknown>
  readonly [key: string]: unknown
}

type ObjectSchemaField = "properties" | "$defs"

const ROOT_COMPOSITION_KEYS = new Set(["anyOf", "oneOf", "allOf"])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const mergeObjectFields = (
  sources: ReadonlyArray<unknown>
): Record<string, unknown> | undefined => {
  const merged = sources.reduce<Record<string, unknown>>(
    (acc, source) => isRecord(source) ? { ...source, ...acc } : acc,
    {}
  )
  return Object.keys(merged).length > 0 ? merged : undefined
}

const rootCompositionBranches = (schema: object): ReadonlyArray<Record<string, unknown>> =>
  [...ROOT_COMPOSITION_KEYS].flatMap((key) => {
    const branches = Reflect.get(schema, key)
    return Array.isArray(branches) ? branches.filter(isRecord) : []
  })

const schemaAndCompositionDescendants = (
  schema: object
): ReadonlyArray<object> => [
  schema,
  ...rootCompositionBranches(schema).flatMap(schemaAndCompositionDescendants)
]

const mergedSchemaField = (
  schema: object,
  field: ObjectSchemaField
): Record<string, unknown> | undefined =>
  mergeObjectFields(schemaAndCompositionDescendants(schema).map((branch) => Reflect.get(branch, field)))

/**
 * Some tool clients reject root-level schema composition. Branch-only required
 * constraints stay runtime-only because union branches represent alternatives.
 */
export const toClientCompatibleInputSchema = (schema: object): McpInputSchema => {
  const rootFields = Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== "type" && !ROOT_COMPOSITION_KEYS.has(key))
  )
  const properties = mergedSchemaField(schema, "properties")
  const defs = mergedSchemaField(schema, "$defs")

  return {
    ...rootFields,
    type: "object",
    ...(properties === undefined ? {} : { properties }),
    ...(defs === undefined ? {} : { $defs: defs })
  } satisfies McpInputSchema
}
