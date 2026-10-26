import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BLANK_TEMPLATE_ID, TEMPLATE_IDS } from "@webforge/templates";
import { readTemplates } from "@webforge/templates/node";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
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

/** The templates New Site lists: every one the app ships but Blank, which it offers on its own. */
const LISTED = TEMPLATE_IDS.filter((id) => id !== BLANK_TEMPLATE_ID);

describe("registerTemplatesHandlers (2.14a)", () => {
  it("lists the templates the app ships, without their content, with their thumbnails", async () => {
    const [cafe] = readTemplates();
    const listed = (await invoker("templates:list")()) as { id: string }[];
    expect(listed[0]).toEqual({
      id: "cafe",
      category: "food",
      example: true,
      pages: 4,
      theme: "bistro",
      thumbnail: `data:image/png;base64,${readFileSync(cafe?.thumbnail ?? "").toString("base64")}`,
    });
    // Every other template too, in the order the app ships them.
    expect(listed.map((each) => each.id)).toEqual(LISTED);
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
    expect(listed).toEqual(LISTED.map((id) => expect.objectContaining({ id, thumbnail: null })));
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(invoker("templates:list", false)()).rejects.toThrow();
  });

  it("reads each thumbnail once, however often New Site lists them (#456 review)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "webforge-thumbnails-"));
    try {
      const thumbnail = join(dir, "thumbnail.png");
      writeFileSync(thumbnail, new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
      const read = vi.fn(() => readTemplates().map((folder) => ({ ...folder, thumbnail })));
      const registered = new Map<string, Handler>();
      const ipc = {
        handle: (name: string, handler: Handler) => registered.set(name, handler),
      } as unknown as Pick<IpcMain, "handle">;
      registerTemplatesHandlers(ipc, () => true, read);
      const list = () =>
        registered.get("templates:list")?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent);

      const first = await list();
      // Gone from disk: a second list that read it again would have no thumbnail.
      rmSync(thumbnail);
      const second = await list();

      expect(second).toEqual(first);
      // Every template but Blank (2.15c).
      expect(second).toEqual(
        LISTED.map((id) =>
          expect.objectContaining({ id, thumbnail: "data:image/png;base64,iVBORw==" }),
        ),
      );
      expect(read).toHaveBeenCalledOnce();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
