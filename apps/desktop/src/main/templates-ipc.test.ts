import { readFileSync } from "node:fs";
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
  it("lists the templates the app ships, without their content, with their thumbnails", async () => {
    const [sample, personal] = readTemplates();
    const thumbnail = (path = "") =>
      `data:image/png;base64,${readFileSync(path).toString("base64")}`;
    expect(await invoker("templates:list")()).toEqual([
      {
        id: "sample",
        category: "food",
        example: true,
        pages: 2,
        theme: "light",
        thumbnail: thumbnail(sample?.thumbnail),
      },
      {
        id: "personal",
        category: "personal",
        example: false,
        pages: 4,
        theme: "studio",
        thumbnail: thumbnail(personal?.thumbnail),
      },
    ]);
  });

  it("leaves Blank out: New Site offers it on its own (2.15c)", async () => {
    const listed = (await invoker("templates:list")()) as { id: string }[];
    expect(listed.map((each) => each.id)).not.toContain("blank");
  });

  it("sends no thumbnail for a template without one (2.14b)", async () => {
    const registered = new Map<string, Handler>();
    const ipc = {
      handle: (name: string, handler: Handler) => registered.set(name, handler),
    } as unknown as Pick<IpcMain, "handle">;
    registerTemplatesHandlers(
      ipc,
      () => true,
      () => readTemplates().map((folder) => ({ ...folder, thumbnail: "/no/such/thumbnail.png" })),
    );
    const listed = await registered.get("templates:list")?.({
      senderFrame: { url: "app" },
    } as IpcMainInvokeEvent);
    expect(listed).toEqual([
      expect.objectContaining({ id: "sample", thumbnail: null }),
      expect.objectContaining({ id: "personal", thumbnail: null }),
    ]);
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(invoker("templates:list", false)()).rejects.toThrow();
  });
});
