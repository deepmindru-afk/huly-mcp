# Huly MCP Homepage

Static Cloudflare Pages site for the Huly MCP homepage.

Cloudflare Pages settings:
- Project name: `huly-mcp-homepage`
- Root directory: `site`
- Framework preset: None
- Build command: leave empty
- Build output directory: `/`
- Production branch: `master`
- Custom domain: `huly-mcp.dearlordylord.com`

The repository root also includes `wrangler.toml` with `pages_build_output_dir = "./site"`
so Git deployments publish this static homepage directory when the project root is the repo root.

Custom domain DNS:

```text
Name/host: huly-mcp.dearlordylord.com
Type: CNAME
Value: huly-mcp-homepage.pages.dev
```
