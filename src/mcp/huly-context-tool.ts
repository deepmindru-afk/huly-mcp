import { Schema } from "effect"
import type { SanitizedHulyRuntimeConfigContext } from "../config/config.js"
import type { GetHulyContextResult } from "../domain/schemas/index.js"
import { Count, NonEmptyString } from "../domain/schemas/index.js"
import { VERSION } from "../version.js"
import { DEFAULT_HTTP_PORT } from "./http-transport.js"
import { createToolOutputSchema, hulyContextToolOutputSchema } from "./tool-output-schema.js"
import { resolveToolScope, type ToolScopeSummary } from "./tool-scope.js"
import { type ToolRegistry, toolRegistry } from "./tools/index.js"

const NPM_PACKAGE_NAME = "@firfi/huly-mcp"
export const VERSION_TOOL_NAME = "get_version"
export const GET_HULY_CONTEXT_TOOL_NAME = "get_huly_context"

type BuiltinToolName = typeof VERSION_TOOL_NAME | typeof GET_HULY_CONTEXT_TOOL_NAME

const emptyInputSchema: {
  readonly type: "object"
  readonly properties: Record<string, never>
  readonly additionalProperties: false
} = { type: "object", properties: {}, additionalProperties: false }

export const VersionToolResultSchema = Schema.Struct({
  current: NonEmptyString,
  latest: NonEmptyString
})

export const versionToolDefinition = {
  name: VERSION_TOOL_NAME,
  description: "Returns the current version of this Huly MCP server and the latest version available on npm.",
  inputSchema: emptyInputSchema,
  outputSchema: createToolOutputSchema(VersionToolResultSchema),
  annotations: {
    title: "Get Version",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
}

export const getHulyContextToolDefinition = {
  name: GET_HULY_CONTEXT_TOOL_NAME,
  description:
    "Returns sanitized runtime and configuration context for this Huly MCP session, including package version, transport, auth mode, Huly URL origin/host, workspace, timeout, and native tool scope filtering. Does not connect to Huly. Secret values such as tokens, passwords, and credential headers are never returned.",
  inputSchema: emptyInputSchema,
  outputSchema: hulyContextToolOutputSchema,
  annotations: {
    title: "Get Huly Context",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
}

export const parseToolsets = (
  raw: string | undefined,
  writeError: (message: string) => void
): ToolScopeSummary =>
  resolveToolScope(
    {
      toolsets: raw ?? "",
      tools: ""
    },
    toolRegistry.definitions,
    writeError
  )

const builtinToolNames: ReadonlyArray<BuiltinToolName> = [VERSION_TOOL_NAME, GET_HULY_CONTEXT_TOOL_NAME]

const nonEmptyOrDefault = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === "" ? fallback : trimmed
}

export const buildHulyContext = (
  config: {
    readonly transport: "stdio" | "http"
    readonly httpPort?: number
    readonly httpHost?: string
  },
  registry: ToolRegistry,
  toolScope: ToolScopeSummary,
  runtimeConfig: SanitizedHulyRuntimeConfigContext
): GetHulyContextResult => ({
  package: {
    name: NPM_PACKAGE_NAME,
    version: nonEmptyOrDefault(VERSION, "0.0.0-dev")
  },
  transport: {
    type: config.transport,
    ...(config.transport === "http"
      ? {
        http: {
          host: nonEmptyOrDefault(config.httpHost, "127.0.0.1"),
          port: config.httpPort ?? DEFAULT_HTTP_PORT
        }
      }
      : {})
  },
  huly: runtimeConfig.huly,
  auth: runtimeConfig.auth,
  configSources: runtimeConfig.configSources,
  toolsets: {
    filteringActive: toolScope.filteringActive,
    requestedCategories: toolScope.requestedToolsets,
    enabledCategories: toolScope.enabledToolsets,
    ignoredCategories: toolScope.ignoredToolsets,
    availableCategories: toolScope.availableCategories,
    visibleRegisteredToolCount: Count.make(registry.definitions.length),
    totalRegisteredToolCount: Count.make(toolScope.totalRegisteredToolCount),
    builtinTools: builtinToolNames
  },
  toolScope: {
    active: toolScope.filteringActive,
    requestedToolsets: toolScope.requestedToolsets,
    enabledToolsets: toolScope.enabledToolsets,
    ignoredToolsets: toolScope.ignoredToolsets,
    requestedTools: toolScope.requestedTools,
    enabledTools: toolScope.enabledTools,
    ignoredTools: toolScope.ignoredTools,
    availableCategories: toolScope.availableCategories,
    visibleRegisteredToolCount: Count.make(registry.definitions.length),
    totalRegisteredToolCount: Count.make(toolScope.totalRegisteredToolCount),
    builtinTools: builtinToolNames
  }
})
