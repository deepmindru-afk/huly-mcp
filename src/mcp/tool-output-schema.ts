import { getHulyContextResultJsonSchema } from "../domain/schemas/index.js"
import { ToolWarningCodeSchema } from "../domain/schemas/tool-warnings.js"
import { collectJsonSchemaDefinitions, omitJsonSchemaDocumentMetadata } from "./json-schema-refs.js"

// eslint-disable-next-line import-x/no-unused-modules -- exported to give output schema constants a stable declaration name
export interface McpOutputSchema {
  readonly type: "object"
  readonly properties?: Record<string, unknown>
  readonly required?: Array<string>
  readonly [key: string]: unknown
}

const toolWarningCodeEnum = [...ToolWarningCodeSchema.literals]

const wrapResultOutputSchema = (resultSchema: object): McpOutputSchema => {
  const resultDefs = collectJsonSchemaDefinitions(resultSchema)
  const resultJsonSchemaDialect = "$schema" in resultSchema ? resultSchema["$schema"] : undefined
  const embeddedResultSchema = omitJsonSchemaDocumentMetadata(resultSchema)

  return {
    ...(resultJsonSchemaDialect === undefined ? {} : { $schema: resultJsonSchemaDialect }),
    ...(resultDefs === undefined ? {} : { $defs: resultDefs }),
    type: "object",
    properties: {
      result: embeddedResultSchema
    },
    required: ["result"]
  }
}

export const defaultToolOutputSchema: McpOutputSchema = {
  type: "object",
  properties: {
    result: {
      description:
        "The successful tool result. The same value is also serialized as JSON in the text content for clients that do not read structuredContent."
    },
    warnings: {
      type: "array",
      description:
        "Optional agent-visible warnings about degraded result fidelity. Omitted when the server returned the documented happy-path payload.",
      items: {
        type: "object",
        properties: {
          code: {
            type: "string",
            enum: toolWarningCodeEnum
          },
          message: {
            type: "string",
            minLength: 1
          }
        },
        required: ["code", "message"],
        additionalProperties: false
      }
    }
  },
  required: ["result"]
}

export const versionToolOutputSchema: McpOutputSchema = wrapResultOutputSchema({
  type: "object",
  properties: {
    current: { type: "string", minLength: 1 },
    latest: { type: "string", minLength: 1 }
  },
  required: ["current", "latest"]
})

// Effect JSONSchema emits refs rooted at its own schema document. The MCP output
// wrapper becomes that document, so shared definitions must live on the wrapper root.
export const hulyContextToolOutputSchema: McpOutputSchema = wrapResultOutputSchema(getHulyContextResultJsonSchema)
