import { readTemplates } from "@webforge/templates/node";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it } from "vitest";
import { registerTemplatesHandlers } from "./templates-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** The handler of `channel`, called as from a renderer that `trusted` says it trusts or not. */
function invoker(channel: string, trusted = true) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerTemplatesHandlers(ipc, () => trusted, readTemplates);
  return (...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

describe("registerTemplatesHandlers (2.14a)", () => {
  it("lists the templates the app ships, without their content", async () => {
    expect(await invoker("templates:list")()).toEqual([
      { id: "sample", category: "food", example: true, pages: 2, theme: "light" },
    ]);
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(invoker("templates:list", false)()).rejects.toThrow();
  });
});
