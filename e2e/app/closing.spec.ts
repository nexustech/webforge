import { type ChildProcess, spawn } from "node:child_process";
import { expect, test } from "@playwright/test";
import { closingWithin } from "./launch.js";

// Closing the app in a test's teardown never outlasts the test (#393): Electron's process teardown
// after quitting took up to a minute on a busy machine.

/** A process that runs until it is killed, as an app whose teardown doesn't end looks. */
function endless(): ChildProcess {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
}

const ended = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

test("kills an app whose process hasn't exited once closing has taken too long", async () => {
  const child = endless();
  const app = closingWithin(
    { close: () => new Promise<void>(() => undefined), process: () => child },
    500,
  );

  const start = Date.now();
  await app.close();

  expect(Date.now() - start).toBeLessThan(5_000);
  expect(ended(child)).toBe(true);
});

test("closes once, however often it's asked: a test, then its afterEach", async () => {
  const child = endless();
  let closes = 0;
  const app = closingWithin(
    {
      close: async () => {
        closes += 1;
        child.kill();
      },
      // As Playwright's app once it has closed: it has no process to give.
      process: () => {
        if (closes > 0) throw new TypeError("Cannot read properties of undefined");
        return child;
      },
    },
    2_000,
  );

  await app.close();
  await app.close();

  expect(closes).toBe(1);
});

test("leaves an app that closes in time alone", async () => {
  const child = endless();
  const app = closingWithin(
    { close: () => new Promise<void>((resolve) => setTimeout(resolve, 200)), process: () => child },
    2_000,
  );

  await app.close();
  // Past the time limit: nothing kills it after a close that finished.
  await new Promise((resolve) => setTimeout(resolve, 2_500));

  expect(ended(child)).toBe(false);
  child.kill();
});
