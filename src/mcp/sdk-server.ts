import { Server } from "@modelcontextprotocol/sdk/server/index.js"

import { VERSION } from "../version.js"

export const createDefaultMcpSdkServer = (): Server =>
  new Server(
    {
      name: "huly-mcp",
      version: VERSION
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  )
