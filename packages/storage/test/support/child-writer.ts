import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

/** A child process committing to a project in a loop (see writer.ts). */
export type ChildWriter = {
  /** Sequence number of the last commit the writer reported as returned (0 before the first). */
  lastAcknowledged(): number;
  /** Resolves once at least `count` commits have been acknowledged. */
  waitForCommits(count: number): Promise<void>;
  /** Kills the writer abruptly (SIGKILL / TerminateProcess) and waits for it to exit. */
  kill(): Promise<void>;
};

/**
 * What a child writer does: commit in a loop (`writer.ts`), or import as the storage writer does
 * (`asset-writer.ts`, R13b).
 */
const SCRIPTS = {
  commits: new URL("./writer.ts", import.meta.url),
  imports: new URL("./asset-writer.ts", import.meta.url),
};

/**
 * Starts a writer process on the project at `path`, doing `what`. `hook` is the test kit's
 * `TYPESCRIPT_HOOK`, which lets the process run the TypeScript sources.
 */
export function startChildWriter(
  path: string,
  hook: string,
  what: keyof typeof SCRIPTS = "commits",
): ChildWriter {
  const writerScript = fileURLToPath(SCRIPTS[what]);
  const child: ChildProcess = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "--import", hook, writerScript, path],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let acknowledged = 0;
  let pending = "";
  let stderr = "";
  const waiters: { count: number; resolve: () => void }[] = [];
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
    pending += chunk;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      acknowledged = Number(line);
    }
    for (const waiter of waiters.filter((w) => acknowledged >= w.count)) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  });
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  // "close" fires once the process has exited and its output pipes are drained.
  const exited = once(child, "close");

  return {
    lastAcknowledged: () => acknowledged,
    waitForCommits: (count) =>
      new Promise<void>((resolve, reject) => {
        if (acknowledged >= count) {
          resolve();
          return;
        }
        waiters.push({ count, resolve });
        exited.then(
          () => reject(new Error(`Writer exited before ${count} commits:\n${stderr}`)),
          reject,
        );
      }),
    kill: async () => {
      child.kill("SIGKILL");
      await exited;
    },
  };
}
