import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { POST_FILE_BYTES_MAX, POST_FILES_MAX } from "../shared/ipc/posts.js";
import { chooseAndReadPostFiles, type PostsParts, registerPostsHandlers } from "./posts-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** Parts whose dialog gives `paths`, each file `size` bytes, its text its own path. */
const parts = (paths: readonly string[] | undefined, size = 10): PostsParts => ({
  choosePostFiles: async () => paths,
  sizeOf: async () => size,
  readText: vi.fn(async (path: string) => `﻿# ${path}`),
});

/** The handler of `channel`, called as from a renderer that `trusted` says it trusts or not. */
function invoker(channel: string, trusted = true) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerPostsHandlers(ipc, () => trusted, parts(["/posts/a.md"]));
  return (...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

describe("Import Posts… in main (6.10b)", () => {
  it("reads the files chosen as text, by name, without a byte-order mark", async () => {
    expect(await invoker("posts:choose-files")()).toEqual({
      status: "chosen",
      files: [{ name: "a.md", text: "# /posts/a.md" }],
    });
  });

  it("reads nothing when cancelled, for too many files, or for one too large", async () => {
    expect(await chooseAndReadPostFiles(parts(undefined))).toEqual({ status: "cancelled" });
    expect(await chooseAndReadPostFiles(parts([]))).toEqual({ status: "cancelled" });
    const many = Array.from({ length: POST_FILES_MAX + 1 }, (_, n) => `/p/${n}.md`);
    expect(await chooseAndReadPostFiles(parts(many))).toEqual({ status: "tooMany" });
    const large = parts(["/p/big.csv"], POST_FILE_BYTES_MAX + 1);
    expect(await chooseAndReadPostFiles(large)).toEqual({ status: "tooLarge", name: "big.csv" });
    expect(large.readText).not.toHaveBeenCalled();
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(invoker("posts:choose-files", false)()).rejects.toThrow();
  });
});
