import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { closingWithin, removeWhenFree } from "./launch.js";

// Closing the app in a test's teardown never outlasts the test (#393): Electron's process teardown
// after quitting took up to a minute on a busy machine. Once Webforge says it has closed, the tests
// don't wait for that teardown at all (#534).

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

test("kills a process outright that doesn't end when told to", async () => {
  // Ignores SIGTERM where it can (macOS, Linux); Windows ends a process at once either way.
  const child = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    { stdio: "ignore" },
  );
  // Started, so its SIGTERM handler is in place.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const app = closingWithin(
    { close: () => new Promise<void>(() => undefined), process: () => child },
    200,
    500,
  );

  const start = Date.now();
  await app.close();

  expect(Date.now() - start).toBeLessThan(5_000);
  // On a busy machine, taskkill can take longer than this test's half-second kills (#1099).
  await expect.poll(() => ended(child)).toBe(true);
});

test("gives up on a process that never exits, so a close can't outlast the test (#1099)", async () => {
  // A process no signal ends: its kill does nothing and its exit never comes, as a process stuck in
  // the kernel looks. It has no pid, so Windows' taskkill isn't asked to end a real one.
  const child = Object.assign(new EventEmitter(), {
    pid: undefined,
    exitCode: null,
    signalCode: null,
    kill: () => true,
  }) as unknown as ChildProcess;
  const app = closingWithin(
    { close: () => new Promise<void>(() => undefined), process: () => child },
    200,
    300,
  );

  const start = Date.now();
  await app.close();

  // Its time limit and two waits for the kills, and no more.
  expect(Date.now() - start).toBeLessThan(5_000);
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

/** A process that says Webforge has closed, as main does just before it exits, then runs on. */
function closedThenEndless(): ChildProcess {
  return spawn(
    process.execPath,
    ["-e", "process.stderr.write('[webforge] closed\\n'); setInterval(() => {}, 1000)"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

test("ends an app soon after it says it has closed, not at the time limit (#534)", async () => {
  const child = closedThenEndless();
  const app = closingWithin(
    { close: () => new Promise<void>(() => undefined), process: () => child },
    60_000,
  );

  const start = Date.now();
  await app.close();

  // Its two seconds' grace, and no more: not the minute.
  expect(Date.now() - start).toBeLessThan(10_000);
  expect(ended(child)).toBe(true);
});

test("waits for an app that closes by itself until it says so, then ends it (#534)", async () => {
  const child = closedThenEndless();
  const app = closingWithin(
    { close: () => new Promise<void>(() => undefined), process: () => child },
    60_000,
  );

  const start = Date.now();
  await app.untilClosed();

  expect(Date.now() - start).toBeLessThan(10_000);
  expect(ended(child)).toBe(true);
  // And a close after it waits for that, as an afterEach's does.
  await app.close();
});

test("ends the processes the app started too, before it says it's done (#534)", async () => {
  // Elsewhere Electron's helpers end with their parent; Windows leaves them running.
  test.skip(process.platform !== "win32", "Windows only");
  // A process that starts another, as Electron starts its renderer and GPU processes.
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const helper = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
       process.stdout.write(String(helper.pid)); setInterval(() => {}, 1000);`,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  const [data] = (await once(child.stdout, "data")) as [Buffer];
  const helper = Number(data.toString());
  const app = closingWithin(
    { close: () => new Promise<void>(() => undefined), process: () => child },
    500,
  );

  await app.close();

  expect(ended(child)).toBe(true);
  expect(() => process.kill(helper, 0)).toThrow();
});

test("removes a test's folder once the process holding it has ended (#1112)", async () => {
  // Elsewhere a file that's open can be removed.
  test.skip(process.platform !== "win32", "Windows only");
  const folder = mkdtempSync(join(tmpdir(), "webforge-e2e-held-"));
  // A process with a file in the folder open and shared with no one, as an ending Electron holds
  // its user data's DIPS database. Node's own opens let a file be deleted, so PowerShell's.
  const holder = spawn(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "$file = [IO.File]::Open('DIPS', 'OpenOrCreate', 'ReadWrite', 'None'); 'open'; Start-Sleep 60",
    ],
    { cwd: folder, stdio: ["ignore", "pipe", "ignore"] },
  );
  await once(holder.stdout, "data");
  await expect(rm(folder, { recursive: true, force: true })).rejects.toThrow(/EBUSY/);

  const removed = removeWhenFree(folder);
  setTimeout(() => holder.kill(), 1_000);
  await removed;

  expect(existsSync(folder)).toBe(false);
});

test("cleans up with the asynchronous rm, whose retries work (#534)", () => {
  // Node 24's rmSync gives up on a busy folder at once on Windows (EPERM), whatever its
  // maxRetries, where rm waits for the app's helper processes to let it go.
  const root = join(import.meta.dirname, "..");
  const offending = ["app", "export", "packaged", "perf", "visual"]
    .flatMap((folder) =>
      readdirSync(join(root, folder), { recursive: true, encoding: "utf8" }).map((file) =>
        join(folder, file),
      ),
    )
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => /rmSync\([^)]*maxRetries/.test(readFileSync(join(root, file), "utf8")));
  expect(offending).toEqual([]);
});
