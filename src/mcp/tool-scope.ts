interface ToolScopeToolDefinition {
  readonly name: string
  readonly category: string
}

interface ToolScopeRawEnv {
  readonly hulyToolsets: string
  readonly hulyTools: string
  readonly legacyToolsets: string
}

interface LegacyToolsetsAliasUsage {
  readonly provided: boolean
  readonly used: boolean
  readonly ignored: boolean
}

export interface ToolScopeSummary {
  readonly filteringActive: boolean
  readonly requestedToolsets: ReadonlyArray<string>
  readonly enabledToolsets: ReadonlyArray<string>
  readonly ignoredToolsets: ReadonlyArray<string>
  readonly requestedTools: ReadonlyArray<string>
  readonly enabledTools: ReadonlyArray<string>
  readonly ignoredTools: ReadonlyArray<string>
  readonly legacyToolsets: LegacyToolsetsAliasUsage
  readonly enabledCategories: ReadonlySet<string>
  readonly enabledToolNames: ReadonlySet<string>
  readonly availableCategories: ReadonlyArray<string>
  readonly visibleRegisteredToolCount: number
  readonly totalRegisteredToolCount: number
}

const normalizeCsv = (raw: string): ReadonlyArray<string> => {
  const normalized = raw.split(",").map((part) => part.trim().toLowerCase()).filter((part) => part !== "")
  return [...new Set(normalized)]
}

const orderedCategories = (
  definitions: ReadonlyArray<ToolScopeToolDefinition>
): ReadonlyArray<string> => [...new Set(definitions.map((definition) => definition.category))]

const resolveRequested = (
  requested: ReadonlyArray<string>,
  known: ReadonlySet<string>,
  unknownMessage: (name: string) => string,
  writeError: (message: string) => void
): {
  readonly enabled: ReadonlyArray<string>
  readonly ignored: ReadonlyArray<string>
} =>
  requested.reduce<{
    readonly enabled: ReadonlyArray<string>
    readonly ignored: ReadonlyArray<string>
  }>((acc, name) => {
    if (known.has(name)) {
      return {
        ...acc,
        enabled: [...acc.enabled, name]
      }
    }

    writeError(unknownMessage(name))
    return {
      ...acc,
      ignored: [...acc.ignored, name]
    }
  }, {
    enabled: [],
    ignored: []
  })

export const resolveToolScope = (
  rawEnv: ToolScopeRawEnv,
  definitions: ReadonlyArray<ToolScopeToolDefinition>,
  writeError: (message: string) => void
): ToolScopeSummary => {
  const hulyToolsets = normalizeCsv(rawEnv.hulyToolsets)
  const hulyTools = normalizeCsv(rawEnv.hulyTools)
  const legacyToolsets = normalizeCsv(rawEnv.legacyToolsets)
  const availableCategories = orderedCategories(definitions)
  const knownCategories = new Set(availableCategories)
  const knownToolNames = new Set(definitions.map((definition) => definition.name))
  const legacyProvided = legacyToolsets.length > 0
  const legacyIgnored = legacyProvided && hulyToolsets.length > 0
  const legacyUsed = legacyProvided && hulyToolsets.length === 0
  const requestedToolsets = hulyToolsets.length > 0 ? hulyToolsets : legacyToolsets

  if (legacyIgnored) {
    writeError("Warning: TOOLSETS is deprecated and ignored because HULY_TOOLSETS is set.")
  } else if (legacyUsed) {
    writeError("Warning: TOOLSETS is deprecated; use HULY_TOOLSETS instead.")
  }

  const toolsets = resolveRequested(
    requestedToolsets,
    knownCategories,
    (category) =>
      `Warning: unknown toolset category "${category}", ignoring. Valid categories: ${availableCategories.join(", ")}`,
    writeError
  )
  const tools = resolveRequested(
    hulyTools,
    knownToolNames,
    (tool) => `Warning: unknown tool name "${tool}", ignoring.`,
    writeError
  )
  const filteringActive = requestedToolsets.length > 0 || hulyTools.length > 0
  const enabledCategories = new Set(toolsets.enabled)
  const enabledToolNames = new Set(tools.enabled)
  const visibleRegisteredToolCount = filteringActive
    ? definitions.filter((definition) =>
      enabledCategories.has(definition.category) || enabledToolNames.has(definition.name)
    ).length
    : definitions.length

  return {
    filteringActive,
    requestedToolsets,
    enabledToolsets: toolsets.enabled,
    ignoredToolsets: toolsets.ignored,
    requestedTools: hulyTools,
    enabledTools: tools.enabled,
    ignoredTools: tools.ignored,
    legacyToolsets: {
      provided: legacyProvided,
      used: legacyUsed,
      ignored: legacyIgnored
    },
    enabledCategories,
    enabledToolNames,
    availableCategories,
    visibleRegisteredToolCount,
    totalRegisteredToolCount: definitions.length
  }
}
