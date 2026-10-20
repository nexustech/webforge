import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ClosableWindow, createFlushOnClose } from "./flush-on-close.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";

function setUp() {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const onClosed = vi.fn();
  const flushOnClose = createFlushOnClose(ipc, (url) => url === APP_URL, {
    timeoutMs: 5_000,
    onClosed,
  });
  let closeListener: ((event: { preventDefault(): void }) => void) | undefined;
  const sent: unknown[][] = [];
  const window: ClosableWindow & { close: ReturnType<typeof vi.fn> } = {
    on: (_event, listener) => {
      closeListener = listener;
    },
    close: vi.fn(() => {
      // A real close emits "close" again.
      closeListener?.({ preventDefault: () => undefined });
    }),
    isDestroyed: () => false,
    webContents: { send: (...args: unknown[]) => sent.push(args) },
  };
  flushOnClose.install(window);
  const userCloses = () => {
    const event = { preventDefault: vi.fn() };
    closeListener?.(event);
    return event;
  };
  const answer = (id: unknown, senderUrl = APP_URL) =>
    handlers.get("project:flushed")?.(
      { senderFrame: { url: senderUrl } } as unknown as IpcMainInvokeEvent,
      id,
    );
  return { window, sent, userCloses, answer, onClosed };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createFlushOnClose", () => {
  it("holds the first close back, asks the renderer to save and closes once it has", async () => {
    const { window, sent, userCloses, answer, onClosed } = setUp();

    const event = userCloses();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(sent).toEqual([["app:flush", 1]]);
    expect(window.close).not.toHaveBeenCalled();

    await answer(1);
    await vi.advanceTimersByTimeAsync(0);

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("closes anyway when the renderer doesn't answer within 5 s", async () => {
    const { window, userCloses } = setUp();

    userCloses();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(window.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it("ignores answers for other requests and from other frames", async () => {
    const { window, userCloses, answer } = setUp();
    userCloses();

    await answer(2);
    await expect(answer(1, "https://example.com/")).rejects.toThrow(/untrusted/);
    await expect(answer("1")).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(window.close).not.toHaveBeenCalled();
  });
});
