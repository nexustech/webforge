import { createSite } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishJob } from "../shared/export-worker-protocol.js";
import { createExportRunner } from "./export-worker-client.js";
import { setLogSink } from "./log.js";
import { registerPublishRun } from "./publish-run.js";
import type { WorkerProcess } from "./worker-process.js";

// A publish job carries the destination's sign-in to the worker (ADR 0018 §1). Nothing on its way
// may log it: not the channel when the worker times out, exits or answers wrongly, nor the
// handler when something it didn't expect throws. A marker in the password must reach no line.
const MARKER = "test-only-marker-9f3c2a";

const job = {
  type: "publish",
  site: createSite({ name: "Rosa's", language: "en", homeTitle: "Home", notFoundTitle: "Oops" }),
  destination: {
    id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
    name: "Live",
    kind: "file-transfer",
    settings: { protocol: "ftps", host: "ftp.example.com", user: "rosa", folder: "/" },
  },
  signIn: { password: MARKER },
  trust: {},
  target: { site: { projectId: "p", destinationId: "d" } },
  trustedCode: [],
  fonts: [],
  families: [],
} satisfies PublishJob;

/** Every line logged while the test runs. */
function logged(): string[] {
  const lines: string[] = [];
  setLogSink((_level, line) => lines.push(line));
  return lines;
}

afterEach(() => {
  setLogSink();
});

/** A worker that takes the job and then does what the test says: nothing, exit, or nonsense. */
function worker() {
  const listeners: { message?: (message: unknown) => void; exit?: (code: number) => void } = {};
  const made = {
    postMessage: vi.fn(),
    on: (event: "message" | "exit", listener: (value: never) => void) => {
      listeners[event] = listener as never;
      return made;
    },
    kill: vi.fn(() => true),
  };
  return { process: made as typeof made & WorkerProcess, listeners };
}

describe("a publish's sign-in reaches no log (ADR 0018 §1)", () => {
  it("not when the worker times out, exits or answers something else", async () => {
    const lines = logged();
    for (const end of ["timeout", "exit", "nonsense"] as const) {
      const made = worker();
      const runner = createExportRunner(
        () => made.process,
        end === "timeout" ? 20 : 60_000,
        end === "timeout" ? 20 : 60_000,
      );
      const publishing = runner.publish(job, { readMedia: async () => undefined });
      await vi.waitFor(() => expect(made.process.postMessage).toHaveBeenCalled());
      expect(JSON.stringify(made.process.postMessage.mock.calls)).toContain(MARKER);
      if (end === "exit") made.listeners.exit?.(1);
      if (end === "nonsense")
        made.listeners.message?.({
          message: "outcome",
          id:
            (made.process.postMessage.mock.calls[0]?.[0] as { id?: number } | undefined)?.id ?? -1,
          outcome: MARKER,
        });

      expect(await publishing).toMatchObject({ type: "failed" });
      runner.close();
    }
    expect(lines.join("\n")).not.toContain(MARKER);
  });

  it("not when something the handler didn't expect throws with it", async () => {
    const lines = logged();
    const registered = new Map<
      string,
      (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
    >();
    registerPublishRun(
      {
        handle: (name: string, handler: never) => registered.set(name, handler),
      } as unknown as Pick<IpcMain, "handle">,
      () => true,
      {
        site: () => ({
          withStore: async () => {
            throw new Error(`could not read with ${MARKER}`);
          },
          staleReason: () => undefined,
          readMedia: async () => undefined,
        }),
        secrets: { signInFor: async () => undefined },
        trusted: async () => () => false,
        fontsOf: async () => ({ fonts: [], families: [] }),
        runner: { publish: vi.fn() },
        sendProgress: vi.fn(),
      },
    );

    const result = await registered.get("publish:publish")?.(
      { senderFrame: { url: "app" } } as IpcMainInvokeEvent,
      "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
      "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
      "1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f",
      { replaceOtherSite: false },
    );

    expect(result).toEqual({ status: "failed", reason: "unknown" });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join("\n")).not.toContain(MARKER);
  });
});
