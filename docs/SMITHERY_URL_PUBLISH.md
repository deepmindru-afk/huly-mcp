# Smithery Hosted URL Publish

Use this example when publishing an already-hosted HTTP MCP endpoint to Smithery. The server endpoint must be configured with `MCP_TRANSPORT=http`.

```bash
smithery mcp publish "https://your-server.example/mcp" \
  -n "@your-org/huly-mcp" \
  --config-schema docs/smithery-url-config.schema.json
```
