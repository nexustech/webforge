// Security review S17 (docs/reviews/2026-10-30-security-review.md), restored by #655: the log
// file is written by electron-log's Node logger, which opens no IPC channel.
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

// electron-log loads `electron` with a CommonJS require, which vi.mock does not reach, so put a
// fake `electron` in the require cache whose ipcMain records what is registered.
const registered: string[] = [];
const fakeElectron = {
  app: {
    getPath: () => "/tmp",
    getName: () => "Webforge",
    getVersion: () => "0.0.0",
    on: () => undefined,
    isReady: () => false,
    whenReady: () => new Promise(() => undefined),
  },
  ipcMain: {
    on: (channel: string) => registered.push(`on:${channel}`),
    handle: (channel: string) => registered.push(`handle:${channel}`),
  },
};
const require = createRequire(import.meta.url);
const electronPath = require.resolve("electron", {
  paths: [require.resolve("electron-log/main")],
});
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: fakeElectron,
} as unknown as NodeJS.Module;
vi.mock("electron", () => fakeElectron);

describe("log file (security audit deps-2)", () => {
  it("leaves no unchecked IPC channel registered by electron-log", async () => {
    await import("./log-file.js");
    expect(registered.filter((entry) => entry.endsWith("__ELECTRON_LOG__"))).toEqual([]);
  });
});
