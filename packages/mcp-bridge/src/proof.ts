import { createHmac } from "node:crypto";

/** The path a bridge asks the server's proof at, beside the MCP path (ADR 0021). */
export const PROOF_PATH = "/mcp/proof";

/** A challenge's nonce: 256 random bits or more, base64url. */
export const NONCE = /^[A-Za-z0-9_-]{43,128}$/;

/**
 * The server's answer to a challenge: HMAC-SHA256 of `nonce` under the pairing's `proof`, base64url
 * (ADR 0021). It covers the address too (`host`, `127.0.0.1:<port>`, as the server listens and as
 * the bridge reaches it): a program squatting Webforge's old port can't pass a bridge's challenge
 * on to Webforge at another port and hand its answer back.
 */
export function proofFor(proof: string, host: string, nonce: string): string {
  return createHmac("sha256", proof)
    .update(`webforge-mcp-proof/1\n${host}\n${nonce}`, "utf8")
    .digest("base64url");
}
