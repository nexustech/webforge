/** The environment variable E2E tests launch Webforge with, to hear when it has closed (#534). */
export const E2E_CLOSED_VARIABLE = "WEBFORGE_E2E_CLOSED";

/** The line Webforge then writes to stderr, once it has closed and just before it exits. */
export const E2E_CLOSED_LINE = "[webforge] closed";

/**
 * Tells the E2E tests that Webforge has closed: its window is gone and its site saved and closed,
 * so all that's left is Electron tearing the process down. That teardown took up to 80 s on a busy
 * machine (#534), and the tests needn't wait for it. Only in an unpackaged app launched with
 * `WEBFORGE_E2E_CLOSED=1`, as the tests launch it; never in the installed app, nor in `pnpm dev`.
 */
export function announceClosedForE2eTests(
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
  write: (line: string) => void = (line) => process.stderr.write(line),
): void {
  if (!packaged && env[E2E_CLOSED_VARIABLE] === "1") write(`${E2E_CLOSED_LINE}\n`);
}
