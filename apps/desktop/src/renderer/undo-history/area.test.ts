import { createFakeEngine } from "@webforge/test-utils/renderer";
import { describe, expect, it, vi } from "vitest";
import type { EditorContext } from "../editor/areas.js";
import { createPreviewStore } from "../editor/edit-previews.js";
import { createEngineHost } from "../editor/engine-host.js";
import { createImagePickRequests } from "../editor/image-picks.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { undoHistoryArea } from "./area.js";

function setUp() {
  const registries = registriesForTest();
  const engine = createEngineHost();
  const session = sessionWith();
  const flush = vi.fn();
  engine.attach({ engine: createFakeEngine(), connection: { flush, disconnect: vi.fn() } });
  const ctx: EditorContext = {
    ...registries,
    api: fakePreloadApi(),
    session,
    engine,
    compileCss: async () => ({ status: "failed" }),
    sectionPreviews: () => null,
    editPreviews: createPreviewStore(),
    dialogs: { nameSharedSection: vi.fn(), rename: vi.fn(), pickImage: vi.fn() },
    imagePicks: createImagePickRequests(),
  };
  const enabled = (id: string) => registries.commands.get(id)?.enabled !== false;
  const edit = () =>
    session.history.run("Removed a section", (draft) => {
      draft.pages[draft.homePageId]?.doc.content.pop();
    });
  return { ctx, registries, session, flush, enabled, edit };
}

describe("undoHistoryArea (#668)", () => {
  it("registers Undo and Redo on as the history allows, following it as steps are made and undone", () => {
    const { ctx, enabled, edit, session } = setUp();
    undoHistoryArea.register(ctx);

    expect(enabled(COMMAND_IDS.undo)).toBe(false);
    expect(enabled(COMMAND_IDS.redo)).toBe(false);

    edit();
    expect(enabled(COMMAND_IDS.undo)).toBe(true);
    expect(enabled(COMMAND_IDS.redo)).toBe(false);

    session.history.undo();
    expect(enabled(COMMAND_IDS.undo)).toBe(false);
    expect(enabled(COMMAND_IDS.redo)).toBe(true);
  });

  it("registers them on when the history already has a step", () => {
    const { ctx, enabled, edit } = setUp();
    edit();

    undoHistoryArea.register(ctx);

    expect(enabled(COMMAND_IDS.undo)).toBe(true);
  });

  it("flushes the canvas's pending edit before it undoes or redoes", async () => {
    const { ctx, registries, session, flush, edit } = setUp();
    edit();
    undoHistoryArea.register(ctx);
    const undo = vi.spyOn(session.history, "undo");
    const redo = vi.spyOn(session.history, "redo");

    await registries.commands.run(COMMAND_IDS.undo);
    expect(flush).toHaveBeenCalledOnce();
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      undo.mock.invocationCallOrder[0] ?? Number.NaN,
    );

    await registries.commands.run(COMMAND_IDS.redo);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush.mock.invocationCallOrder[1]).toBeLessThan(
      redo.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it("registers the Undo History panel in the left column's bottom", () => {
    const { ctx, registries } = setUp();
    undoHistoryArea.register(ctx);

    expect(registries.panels.list()).toEqual([
      expect.objectContaining({ id: "undoHistory", slot: "left.bottom" }),
    ]);
  });

  it("removes its commands and panel, and stops following the history", () => {
    const { ctx, registries, edit } = setUp();
    const remove = undoHistoryArea.register(ctx);
    const update = vi.spyOn(registries.commands, "update");

    remove();
    edit();

    expect(registries.commands.get(COMMAND_IDS.undo)).toBeUndefined();
    expect(registries.commands.get(COMMAND_IDS.redo)).toBeUndefined();
    expect(registries.panels.list()).toEqual([]);
    expect(update).not.toHaveBeenCalled();
  });
});
