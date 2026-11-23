import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

/** What a writer prints once it waits inside a transaction to be killed (`holdAt`, #1355). */
export const HOLDING = "holding";

/** A child process committing to a project in a loop (see writer.ts). */
export type ChildWriter = {
  /** Sequence number of the last commit the writer reported as returned (0 before the first). */
  lastAcknowledged(): number;
  /** Resolves once at least `count` commits have been acknowledged. */
  waitForCommits(count: number): Promise<void>;
  /** Resolves once the writer waits inside its transaction (started with `holdAt`). */
  waitForHold(): Promise<void>;
  /** Kills the writer abruptly (SIGKILL / TerminateProcess) and waits for it to exit. */
  kill(): Promise<void>;
};

/**
 * What a child writer does: commit in a loop (`writer.ts`), or import as the storage writer does
 * (`site-file-writer.ts`, R13b).
 */
const SCRIPTS = {
  commits: new URL("./writer.ts", import.meta.url),
  imports: new URL("./site-file-writer.ts", import.meta.url),
};

/**
 * Starts a writer process on the project at `path`, doing `what`. `hook` is the test kit's
 * `TYPESCRIPT_HOOK`, which lets the process run the TypeScript sources. With `holdAt`, an imports
 * writer stops inside the transaction of import `holdAt` and waits there to be killed (#1355).
 */
export function startChildWriter(
  path: string,
  hook: string,
  what: keyof typeof SCRIPTS = "commits",
  holdAt?: number,
): ChildWriter {
  const writerScript = fileURLToPath(SCRIPTS[what]);
  const child: ChildProcess = spawn(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      "--import",
      hook,
      writerScript,
      path,
      ...(holdAt === undefined ? [] : [String(holdAt)]),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let acknowledged = 0;
  let holding = false;
  let pending = "";
  let stderr = "";
  const waiters: { ready: () => boolean; resolve: () => void }[] = [];
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line === HOLDING) holding = true;
      else acknowledged = Number(line);
    }
    for (const waiter of waiters.filter((w) => w.ready())) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  });
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  // "close" fires once the process has exited and its output pipes are drained.
  const exited = once(child, "close");
  /** Resolves once `ready` holds, or fails as the writer exits first. */
  const until = (ready: () => boolean, what: string) =>
    new Promise<void>((resolve, reject) => {
      if (ready()) {
        resolve();
        return;
      }
      waiters.push({ ready, resolve });
      exited.then(() => reject(new Error(`Writer exited before ${what}:\n${stderr}`)), reject);
    });

  return {
    lastAcknowledged: () => acknowledged,
    waitForCommits: (count) => until(() => acknowledged >= count, `${count} commits`),
    waitForHold: () => until(() => holding, "holding in a transaction"),
    kill: async () => {
      child.kill("SIGKILL");
      await exited;
    },
  };
}
