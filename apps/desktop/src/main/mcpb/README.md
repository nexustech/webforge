# MCPB manifest schema

`manifest-v0.3.schema.json` is the JSON Schema of an MCPB desktop extension's `manifest.json`, version 0.3, as published in [`@anthropic-ai/mcpb`](https://github.com/modelcontextprotocol/mcpb) 2.1.2 (`dist/mcpb-manifest-v0.3.schema.json`), unchanged. Its licence, MIT, is in `LICENSE` beside it.

`claude-extension.test.ts` checks the manifest Webforge writes for Claude Desktop's extension against it (4.9, ADR 0021). The package itself isn't a dependency: its CLI pulls in zod 3 and `tmp`, which have high advisories with no fix on their lines, and the dependency audit fails on those.

When the manifest moves to another version, copy that version's schema here from the package, and keep the licence.
