import { createFakeEngine } from "@webforge/test-utils/renderer";
import { describe, expect, it, vi } from "vitest";
import type { EditorContext } from "../editor/areas.js";
import { createPreviewStore } from "../editor/edit-previews.js";
import { createEngineHost } from "../editor/engine-host.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { addPanelArea } from "./area.js";

function setUp() {
  const registries = registriesForTest();
  const engine = createEngineHost();
  const ctx: EditorContext = {
    ...registries,
    session: sessionWith(),
    engine,
    compileCss: async () => ({ status: "failed" }),
    sectionPreviews: () => null,
    editPreviews: createPreviewStore(),
    dialogs: { nameSharedSection: vi.fn(), rename: vi.fn(), pickImage: vi.fn() },
  };
  const mount = () => {
    const canvas = createFakeEngine();
    const detach = engine.attach({
      engine: canvas,
      connection: { flush: vi.fn(), disconnect: vi.fn() },
    });
    return { canvas, detach };
  };
  const ids = () => registries.panels.list().map((panel) => panel.id);
  return { ctx, registries, mount, ids };
}

describe("addPanelArea (2.20, B1)", () => {
  it("adds the panel and its palette commands in Design mode only, following the mode", () => {
    const { ctx, registries, ids } = setUp();
    const remove = addPanelArea.register(ctx);
    const adds = () => registries.commands.list().filter((command) => command.palette === "add");

    expect(ids()).toEqual(["add"]);
    expect(adds().length).toBeGreaterThan(0);

    registries.preferences.changeMode("content");
    expect(ids()).toEqual([]);
    expect(adds()).toEqual([]);

    registries.preferences.changeMode("design");
    expect(ids()).toEqual(["add"]);

    remove();
    expect(ids()).toEqual([]);
    expect(adds()).toEqual([]);
  });

  it("is registered again with each canvas engine, and once only for one", () => {
    const { ctx, registries, mount } = setUp();
    const register = vi.spyOn(registries.panels, "register");
    addPanelArea.register(ctx);

    const { detach } = mount();
    expect(register).toHaveBeenCalledTimes(2);

    detach();
    mount();
    expect(register).toHaveBeenCalledTimes(3);
  });

  it("goes with its engine, and isn't registered again until the next one", () => {
    const { ctx, registries, mount, ids } = setUp();
    const { detach } = mount();
    addPanelArea.register(ctx);
    const adds = () => registries.commands.list().filter((command) => command.palette === "add");

    detach();
    expect(ids()).toEqual([]);
    expect(adds()).toEqual([]);

    mount();
    expect(ids()).toEqual(["add"]);
  });

  it("opens its Sections at the canvas's floating +", () => {
    const { ctx, registries, mount } = setUp();
    const { canvas } = mount();
    addPanelArea.register(ctx);
    const show = vi.spyOn(registries.panels, "show");

    canvas.requestAdd({ index: 0 });

    expect(show).toHaveBeenCalledWith("add");
  });

  it("stops opening once the engine unmounts", () => {
    const { ctx, registries, mount } = setUp();
    const { canvas, detach } = mount();
    addPanelArea.register(ctx);
    detach();
    const show = vi.spyOn(registries.panels, "show");

    canvas.requestAdd({ index: 0 });

    expect(show).not.toHaveBeenCalled();
  });
});
