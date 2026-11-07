import { describe, expect, it, vi } from "vitest";
import {
  createSecretClipboard,
  electronSecretClipboard,
  SECRET_CLEARED_AFTER_MS,
  type SecretClipboardSystem,
} from "./secret-clipboard.js";

const KEY = "k".repeat(43);

/** A clipboard holding text, and timers run by hand. */
function setUp() {
  let text = "";
  const system: SecretClipboardSystem & { clear: ReturnType<typeof vi.fn> } = {
    writePrivate: vi.fn(async (written: string) => {
      text = written;
    }),
    readText: async () => text,
    clear: vi.fn(() => {
      text = "";
    }),
  };
  const pending = new Map<number, () => void>();
  let next = 0;
  const delays: number[] = [];
  const timers = {
    set: (run: () => void, ms: number) => {
      delays.push(ms);
      pending.set(++next, run);
      return next;
    },
    cancel: (timer: unknown) => pending.delete(timer as number),
  };
  const secrets = createSecretClipboard(system, timers);
  return {
    system,
    secrets,
    delays,
    pending,
    copyElsewhere: (other: string) => {
      text = other;
    },
    text: () => text,
    /** Runs the timers due, as a minute passing would. */
    elapse: async () => {
      const due = [...pending.values()];
      pending.clear();
      for (const run of due) run();
      await vi.waitFor(() => undefined);
    },
  };
}

describe("the secret clipboard (4.9)", () => {
  it("clears the key after a minute if the clipboard still holds it", async () => {
    const { system, secrets, delays, elapse, text } = setUp();

    await secrets.copy(KEY);
    expect(system.writePrivate).toHaveBeenCalledWith(KEY);
    expect(delays).toEqual([SECRET_CLEARED_AFTER_MS]);
    expect(text()).toBe(KEY);

    await elapse();
    await vi.waitFor(() => expect(system.clear).toHaveBeenCalledOnce());
    expect(text()).toBe("");
  });

  it("leaves the clipboard be if something else was copied since", async () => {
    const { system, secrets, elapse, copyElsewhere, text } = setUp();

    await secrets.copy(KEY);
    copyElsewhere("a shopping list");
    await elapse();

    expect(system.clear).not.toHaveBeenCalled();
    expect(text()).toBe("a shopping list");
  });

  it("waits a minute from the last copy, clearing only that one", async () => {
    const { system, secrets, pending, elapse, text } = setUp();

    await secrets.copy(KEY);
    await secrets.copy("j".repeat(43));
    expect(pending.size).toBe(1);

    await elapse();
    await vi.waitFor(() => expect(system.clear).toHaveBeenCalledOnce());
    expect(text()).toBe("");
  });

  it("clears it when Webforge quits, once", async () => {
    const { system, secrets, pending } = setUp();

    await secrets.copy(KEY);
    await secrets.clearIfHeld();
    await secrets.clearIfHeld();

    expect(system.clear).toHaveBeenCalledOnce();
    expect(pending.size).toBe(0);
  });
});

describe("Electron's clipboard for secrets", () => {
  class FakeItem {
    constructor(readonly items: Record<string, unknown>) {}
  }
  const electron = (write = vi.fn(async () => undefined)) => ({
    write,
    module: {
      clipboard: { write, readText: vi.fn(async () => ""), clear: vi.fn() },
      ClipboardItem: FakeItem,
    } as unknown as Pick<typeof import("electron"), "clipboard" | "ClipboardItem">,
  });

  it("writes the text with the formats that keep it out of Windows' clipboard history", async () => {
    const { write, module } = electron();

    await electronSecretClipboard(module, "win32").writePrivate(KEY);

    const [[items]] = write.mock.calls as unknown as [[FakeItem[]]];
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]?.items ?? {})).toEqual([
      "text/plain",
      'electron application/osclipboard;format="ExcludeClipboardContentFromMonitorProcessing"',
      'electron application/osclipboard;format="CanIncludeInClipboardHistory"',
      'electron application/osclipboard;format="CanUploadToCloudClipboard"',
    ]);
    expect(items[0]?.items["text/plain"]).toBe(KEY);
  });

  it("writes the text alone elsewhere", async () => {
    const { write, module } = electron();

    await electronSecretClipboard(module, "darwin").writePrivate(KEY);

    const [[items]] = write.mock.calls as unknown as [[FakeItem[]]];
    expect(Object.keys(items[0]?.items ?? {})).toEqual(["text/plain"]);
  });
});
