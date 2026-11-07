// The bridge's entry point, as Claude Desktop runs it from Webforge's extension (ADR 0021):
// `node server/index.mjs`, with its settings in the environment. It writes only MCP messages to
// stdout, and nothing to stderr: there's nothing of a message it may log.

import { runBridge } from "./bridge.js";
import { configFromEnv } from "./config.js";

const config = configFromEnv(process.env);
if (config === undefined) {
  // The manifest Webforge wrote sets every setting but the key: this isn't Webforge's extension.
  process.exitCode = 1;
} else {
  await runBridge({ input: process.stdin, output: process.stdout, config });
}
