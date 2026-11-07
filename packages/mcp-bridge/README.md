# @webforge/mcp-bridge

`webforge-bridge`: the small relay Claude Desktop runs from Webforge's desktop extension (4.9, [ADR 0021](../../docs/adr/0021-mcp-transport.md)). It takes MCP over stdio and sends each message on to Webforge's MCP server on `127.0.0.1`, with the paired app's key in `Authorization`.

## Public API
- **`runBridge({ input, output, config })`:** relays MCP from `input` to Webforge and its answers to `output`, one JSON-RPC message a line. Before the key goes on any connection, it checks that Webforge is answering there (below). When Webforge has ended the session, it starts another with the app's own `initialize`, unseen by the app. It logs nothing.
- **`configFromEnv(env)` and `BRIDGE_ENV`:** the bridge's settings from the environment the extension's manifest sets: the address, the app's id, the server proof, the key (the extension's one `sensitive` setting) and the messages it answers with, in the person's language.
- **`proofFor(proof, host, nonce)`, `PROOF_PATH` and `NONCE`:** the server proof's challenge, which Webforge's listener answers and the bridge checks: HMAC-SHA256 of the nonce and the address under the pairing's proof.
- **`@webforge/mcp-bridge/build`:** `buildBridge(outfile)` bundles the bridge into one ES module with esbuild, readable, needing nothing but Node.js. The desktop app's build writes it to `out/bridge/`, which electron-builder puts beside app.asar.

## The check
For each message, the bridge opens a connection, sends a fresh nonce with the app's id and no key, and compares the answer with `proofFor` in constant time. Only then does it send the message, with the key, on that same connection: a request that would need another connection fails before anything is sent. A program that took Webforge's port while it was closed never gets the key, and the AI app is told that something else is answering.

## Boundaries
- Node.js built-ins and zod only: it runs on Claude Desktop's own Node.js, as Electron's `RunAsNode` fuse is off.
- `main.ts` writes MCP messages to stdout and nothing to stderr.
