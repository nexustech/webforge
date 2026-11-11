import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { IpcMain } from "electron";
import { type ChosenPostFiles, POST_FILE_BYTES_MAX, POST_FILES_MAX } from "../shared/ipc/posts.js";
import { registerIpcHandler } from "./ipc.js";

/** What reading posts to import needs: the system's dialog, and the files it gives. */
export type PostsParts = {
  /** The files the person chose, or `undefined` when they cancelled. */
  choosePostFiles(): Promise<readonly string[] | undefined>;
  /** The size of a file, in bytes. */
  sizeOf(path: string): Promise<number>;
  /** A file's text, as UTF-8. */
  readText(path: string): Promise<string>;
};

/** The parts on this computer's own files. */
export const filePostsParts = (choose: PostsParts["choosePostFiles"]): PostsParts => ({
  choosePostFiles: choose,
  sizeOf: async (path) => (await stat(path)).size,
  readText: (path) => readFile(path, "utf8"),
});

/**
 * The files the person chose to import posts from (6.10b), read as text: only those, at most
 * {@link POST_FILES_MAX} and each at most {@link POST_FILE_BYTES_MAX}, or nothing.
 */
export async function chooseAndReadPostFiles(parts: PostsParts): Promise<ChosenPostFiles> {
  const paths = await parts.choosePostFiles();
  if (paths === undefined || paths.length === 0) return { status: "cancelled" };
  if (paths.length > POST_FILES_MAX) return { status: "tooMany" };
  const files: { name: string; text: string }[] = [];
  for (const path of paths) {
    const name = basename(path);
    if ((await parts.sizeOf(path)) > POST_FILE_BYTES_MAX) return { status: "tooLarge", name };
    // A byte-order mark is no part of the text.
    files.push({ name, text: (await parts.readText(path)).replace(/^﻿/, "") });
  }
  return { status: "chosen", files };
}

/** Registers the `posts` IPC calls: *Import Posts…*'s files, read in main (6.10b). */
export function registerPostsHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  parts: PostsParts,
): void {
  registerIpcHandler(ipc, "postsChooseFiles", isTrustedSender, () => chooseAndReadPostFiles(parts));
}
