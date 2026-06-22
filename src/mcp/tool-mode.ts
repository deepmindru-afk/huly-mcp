export type ToolExposureMode = "native" | "proxy"
export type ToolModeConfig = "auto" | "native" | "proxy"

export type ClientKind =
  | "claude-code"
  | "claude-ai"
  | "cursor"
  | "windsurf"
  | "github-copilot"
  | "codex"
  | "opencode"
  | "unknown"

export const DEFAULT_MODE_BY_CLIENT_KIND = {
  "claude-code": "native",
  "claude-ai": "proxy",
  cursor: "proxy",
  windsurf: "proxy",
  "github-copilot": "proxy",
  codex: "proxy",
  opencode: "proxy",
  unknown: "proxy"
} satisfies Record<ClientKind, ToolExposureMode>

export interface McpClientInfoLike {
  readonly name?: string
}

export interface ResolveToolExposureModeInput {
  readonly configuredMode: ToolModeConfig
  readonly clientInfo?: McpClientInfoLike
}

const rawClientName = (clientInfo: McpClientInfoLike | undefined): string => {
  const name = clientInfo?.name?.trim().toLowerCase()
  if (name === undefined || name === "") return ""

  return name
}

const withoutRemoteSuffix = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, "").trim()

export const classifyMcpClient = (
  clientInfo: McpClientInfoLike | undefined
): ClientKind => {
  const rawName = rawClientName(clientInfo)

  if (rawName === "claude-code") return "claude-code"

  const name = withoutRemoteSuffix(rawName)

  if (name === "claude-code") return "unknown"
  if (name === "claude-ai") return "claude-ai"
  if (name === "cursor-vscode" || name.startsWith("cursor")) return "cursor"
  if (name.startsWith("windsurf") || name.startsWith("cascade")) return "windsurf"
  if (name.startsWith("github-copilot") || name.startsWith("copilot") || name.startsWith("vscode")) {
    return "github-copilot"
  }
  if (name.startsWith("codex") || name.startsWith("openai-codex")) return "codex"
  if (name.startsWith("opencode")) return "opencode"

  return "unknown"
}

export const resolveToolExposureMode = (
  input: ResolveToolExposureModeInput
): ToolExposureMode => {
  if (input.configuredMode !== "auto") return input.configuredMode

  return DEFAULT_MODE_BY_CLIENT_KIND[classifyMcpClient(input.clientInfo)]
}
