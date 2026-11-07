// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import {
  focusRegion,
  REGION_ATTRIBUTE,
  registerRegionCommands,
  trackRegionFocus,
} from "./regions.js";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A window of parts: the title bar, the left panels (hidden), the page, and the right panels. */
function windowOfParts() {
  document.body.innerHTML = `
    <header ${REGION_ATTRIBUTE}><button id="file">File</button><button id="undo">Undo</button></header>
    <section ${REGION_ATTRIBUTE} hidden><button id="add">Add</button></section>
    <section ${REGION_ATTRIBUTE} id="canvas"><iframe id="frame" title="Page"></iframe></section>
    <section ${REGION_ATTRIBUTE} id="right"><p>Select an element to edit it</p></section>
    <button id="outside">Outside</button>
  `;
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  return { byId, focused: () => document.activeElement?.id ?? "" };
}

describe("the window's parts (F6, 5.5)", () => {
  it("moves to each shown part in turn, and wraps around, both ways", () => {
    const { byId, focused } = windowOfParts();
    byId("outside").focus();
    expect(focusRegion(document, 1)).toBe(true);
    expect(focused()).toBe("file");
    focusRegion(document, 1);
    // The hidden left panels are skipped; the page's frame takes the focus.
    expect(focused()).toBe("frame");
    // A part with nothing to focus takes it itself.
    focusRegion(document, 1);
    expect(focused()).toBe("right");
    expect(byId("right").tabIndex).toBe(-1);
    focusRegion(document, 1);
    expect(focused()).toBe("file");
    focusRegion(document, -1);
    expect(focused()).toBe("right");
  });

  it("skips a control that doesn't take the focus, such as one hidden with CSS", () => {
    const { byId, focused } = windowOfParts();
    const hiddenByCss = document.createElement("button");
    hiddenByCss.id = "action";
    // As a button Puck hides with CSS: focusing it does nothing.
    hiddenByCss.focus = () => undefined;
    byId("canvas").prepend(hiddenByCss);
    byId("file").focus();
    focusRegion(document, 1);
    expect(focused()).toBe("frame");
  });
  it("goes back to where the focus was last in a part", () => {
    const { byId, focused } = windowOfParts();
    const stop = trackRegionFocus(document);
    byId("undo").focus();
    focusRegion(document, 1);
    expect(focused()).toBe("frame");
    focusRegion(document, -1);
    expect(focused()).toBe("undo");
    stop();
  });

  it("from nowhere, goes to the first or the last part; with none, does nothing", () => {
    const { focused } = windowOfParts();
    (document.activeElement as HTMLElement | null)?.blur();
    focusRegion(document, -1);
    expect(focused()).toBe("right");
    document.body.innerHTML = "<button>Alone</button>";
    expect(focusRegion(document, 1)).toBe(false);
  });

  it("is View › Next and Previous Part of the Window, on F6 and Shift+F6", () => {
    const { byId, focused } = windowOfParts();
    const registry = createCommandRegistry({ mac: false });
    const remove = registerRegionCommands(registry, document);
    expect(registry.get(COMMAND_IDS.nextRegion)).toMatchObject({
      label: "Next Part of the Window",
      menu: "view",
      shortcut: "F6",
    });
    expect(registry.get(COMMAND_IDS.previousRegion)?.shortcut).toBe("Shift+F6");

    byId("file").focus();
    registry.run(COMMAND_IDS.nextRegion);
    expect(focused()).toBe("frame");
    registry.run(COMMAND_IDS.previousRegion);
    expect(focused()).toBe("file");
    remove();
    expect(registry.get(COMMAND_IDS.nextRegion)).toBeUndefined();
  });
});
