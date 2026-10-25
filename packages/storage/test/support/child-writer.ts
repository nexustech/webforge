import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { TYPESCRIPT_HOOK } from "@webforge/test-utils";

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
 * Starts a writer process on the project at `path`: `writer.ts`, which commits, or another script
 * here, such as `asset-writer.ts`, which imports as the storage writer does (R13b).
 */
export function startChildWriter(path: string, script = "writer.ts"): ChildWriter {
  const writerScript = fileURLToPath(new URL(`./${script}`, import.meta.url));
  const child: ChildProcess = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "--import", TYPESCRIPT_HOOK, writerScript, path],
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
