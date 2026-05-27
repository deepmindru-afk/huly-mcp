#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const parseToolsFromFile = (filePath) => {
  const content = readFileSync(filePath, "utf-8")
  const tools = []

  const categoryMatch = content.match(/const CATEGORY = "([^"]+)" as const/)
  if (!categoryMatch) return tools

  const category = categoryMatch[1]
  const toolPattern = /\{\s*name:\s*"([^"]+)"[\s\S]*?description:[\s\S]*?"([^"]+)"[\s\S]*?category:\s*CATEGORY/g

  let match
  while ((match = toolPattern.exec(content)) !== null) {
    tools.push({
      name: match[1],
      description: match[2],
      category
    })
  }

  return tools
}

const parseResourceTemplatesFromFile = (filePath) => {
  const content = readFileSync(filePath, "utf-8")
  const mimeTypeMatch = content.match(/export const HULY_RESOURCE_MIME_TYPE = "([^"]+)"/)
  const mimeType = mimeTypeMatch?.[1] ?? ""
  const templates = []
  const templatePattern =
    /\{\s*uriTemplate:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"[\s\S]*?mimeType:\s*HULY_RESOURCE_MIME_TYPE/g

  let match
  while ((match = templatePattern.exec(content)) !== null) {
    templates.push({
      uriTemplate: match[1],
      name: match[2],
      description: match[3],
      mimeType
    })
  }

  return templates
}

const toolsDir = join(process.cwd(), "src/mcp/tools")
const toolFiles = readdirSync(toolsDir)
  .filter((file) => file.endsWith(".ts") && file !== "index.ts" && file !== "registry.ts")

const allTools = toolFiles.flatMap((file) => parseToolsFromFile(join(toolsDir, file)))
const resourceTemplates = parseResourceTemplatesFromFile(join(process.cwd(), "src/mcp/resources.ts"))

const categoryOrder = [
  "projects",
  "issues",
  "comments",
  "milestones",
  "documents",
  "storage",
  "attachments",
  "contacts",
  "channels",
  "calendar",
  "time tracking",
  "search",
  "associations",
  "activity",
  "notifications",
  "workspace"
]

const capitalize = (value) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase())

const toolsByCategory = new Map()
for (const tool of allTools) {
  const existing = toolsByCategory.get(tool.category) ?? []
  existing.push(tool)
  toolsByCategory.set(tool.category, existing)
}

const appendCategory = (output, categoryName, tools) => {
  let nextOutput = output
  nextOutput += `### ${capitalize(categoryName)}\n\n`
  nextOutput += "| Tool | Description |\n"
  nextOutput += "|------|-------------|\n"

  for (const tool of tools) {
    const escapedDesc = tool.description.replace(/\|/g, "\\|").replace(/\n/g, " ")
    nextOutput += `| \`${tool.name}\` | ${escapedDesc} |\n`
  }

  return `${nextOutput}\n`
}

const escapeTableCell = (value) =>
  value.replace(/\|/g, "\\|").replace(/\n/g, " ")

const generateToolsSection = () => {
  const categories = [
    ...categoryOrder.filter((category) => toolsByCategory.has(category)),
    ...[...toolsByCategory.keys()].filter((category) => !categoryOrder.includes(category))
  ]
  let output = "## Available Tools\n\n"
  output += `**\`TOOLSETS\` categories:** ${categories.map((category) => `\`${category}\``).join(", ")}\n\n`

  for (const categoryName of categoryOrder) {
    const tools = toolsByCategory.get(categoryName)
    if (tools === undefined || tools.length === 0) continue
    output = appendCategory(output, categoryName, tools)
  }

  for (const [categoryName, tools] of toolsByCategory) {
    if (categoryOrder.includes(categoryName) || tools.length === 0) continue
    output = appendCategory(output, categoryName, tools)
  }

  return output
}

const generateResourcesSection = () => {
  let output =
    "<!-- AUTO-GENERATED from src/mcp/resources.ts resourceTemplates. Do not edit manually. Run `pnpm update-readme` to regenerate. -->\n"
  output += "| Template | Name | Description | MIME Type |\n"
  output += "|----------|------|-------------|-----------|\n"

  for (const resource of resourceTemplates) {
    output +=
      `| \`${resource.uriTemplate}\` | \`${resource.name}\` | ${escapeTableCell(resource.description)} | \`${resource.mimeType}\` |\n`
  }

  return output
}

const replaceGeneratedSection = (content, startMarker, endMarker, generated) => {
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1) {
    console.error(`Error: Could not find ${startMarker} / ${endMarker} markers in README.md`)
    console.error("Please add the following markers where you want the generated section:")
    console.error(startMarker)
    console.error(endMarker)
    process.exit(1)
  }

  const before = content.substring(0, startIdx + startMarker.length)
  const after = content.substring(endIdx)
  return `${before}\n${generated}${after}`
}

const readmePath = join(process.cwd(), "README.md")
let content = readFileSync(readmePath, "utf-8")

const autoGenComment =
  "<!-- AUTO-GENERATED from src/mcp/tools/ descriptions. Do not edit manually. Run `pnpm update-readme` to regenerate. -->"
content = replaceGeneratedSection(
  content,
  "<!-- resources:start -->",
  "<!-- resources:end -->",
  generateResourcesSection()
)
content = replaceGeneratedSection(
  content,
  "<!-- tools:start -->",
  "<!-- tools:end -->",
  `${autoGenComment}\n${generateToolsSection()}`
)

writeFileSync(readmePath, content, "utf-8")
console.log(
  `✅ README.md updated with ${allTools.length} tools in ${toolsByCategory.size} categories and ${resourceTemplates.length} resource templates`
)
