// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showFrameTooltips, TIP_ATTRIBUTE } from "./frame-tooltips.js";

// The canvas chrome's tooltips (#1011): the editor's, in the canvas's document.

const tip = () => document.querySelector(".wf-tip");

const over = (element: Element) =>
  element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
const out = (element: Element, to: Element | null = document.body) =>
  element.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: to }));

describe("showFrameTooltips", () => {
  let stop: () => void = () => undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    stop = showFrameTooltips(document);
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  /** A control of the chrome's own, with a tooltip. */
  function control(text: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.setAttribute("aria-label", text);
    button.setAttribute(TIP_ATTRIBUTE, text);
    document.body.append(button);
    return button;
  }

  it("shows a control's tooltip after a short rest, then the next one at once", () => {
    const add = control("Add a section here");
    const grip = control("Drag to change Padding (top)");

    over(add);
    expect(tip()).toBeNull();
    vi.advanceTimersByTime(400);
    expect(tip()?.textContent).toBe("Add a section here");
    // Read by the control's own name, not twice.
    expect(tip()?.getAttribute("aria-hidden")).toBe("true");

    out(add, grip);
    over(grip);
    expect(tip()?.textContent).toBe("Drag to change Padding (top)");
    out(grip);
    expect(tip()).toBeNull();
  });

  it("shows on the keyboard's focus, and hides on Escape, a press and leaving", () => {
    const add = control("Add a section here");
    add.focus();
    expect(tip()?.textContent).toBe("Add a section here");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(tip()).toBeNull();

    add.blur();
    over(add);
    add.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    vi.advanceTimersByTime(400);
    // Not over a control being used (a grip being dragged).
    expect(tip()).toBeNull();
  });

  it("keeps the pointer's tooltip as focus moves elsewhere and the page scrolls", () => {
    const add = control("Add a section here");
    const other = Object.assign(document.createElement("input"), { type: "text" });
    document.body.append(other);
    other.focus();

    over(add);
    // Selecting moves the focus out of the frame (macOS CI, #1011), and Puck scrolls to it.
    other.blur();
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(400);
    expect(tip()?.textContent).toBe("Add a section here");
    window.dispatchEvent(new Event("scroll"));
    expect(tip()?.textContent).toBe("Add a section here");
  });

  it("takes Puck's title on its element bar as a tooltip, keeping it as the name", () => {
    const bar = document.createElement("div");
    bar.className = "_DraggableComponent-actions_abc";
    const remove = document.createElement("button");
    remove.title = "Delete";
    bar.append(remove);
    // A title elsewhere (the site's own) is left alone.
    const site = Object.assign(document.createElement("abbr"), { title: "Limited" });
    document.body.append(bar, site);

    over(remove);
    expect(remove.hasAttribute("title")).toBe(false);
    expect(remove.getAttribute("aria-label")).toBe("Delete");
    vi.advanceTimersByTime(400);
    expect(tip()?.textContent).toBe("Delete");

    over(site);
    expect(site.title).toBe("Limited");
  });

  it("stops showing them", () => {
    const add = control("Add a section here");
    stop();
    over(add);
    vi.advanceTimersByTime(400);
    expect(tip()).toBeNull();
  });
});
