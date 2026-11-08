/** The environment variable E2E tests launch Webforge with, to publish to a mock Netlify (#70). */
const E2E_NETLIFY_VARIABLE = "WEBFORGE_E2E_NETLIFY_API";

/** The hosts a mock Netlify may be on: this computer only. */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The address of Netlify's API the app talks to: `undefined` for Netlify's own (`NETLIFY_API`),
 * or, in an unpackaged app launched with `WEBFORGE_E2E_NETLIFY_API` set to a mock on this computer
 * (`http://127.0.0.1:<port>/api/v1`), that mock, as the E2E tests launch it. Never in the installed
 * app, whatever its environment holds, so no one can send a person's Netlify token elsewhere by
 * setting a variable; and never an address on another computer.
 */
export function netlifyApiFor(
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = env[E2E_NETLIFY_VARIABLE];
  if (packaged || value === undefined) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname) ? value : undefined;
  } catch {
    return undefined;
  }
}
