// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startEditingOnType, typedCharacter } from "./type-to-edit.js";

/** A key press with `key`, no modifiers unless given. */
const press = (key: string, extra: Partial<KeyboardEventInit> & { altGr?: boolean } = {}) => {
  const { altGr = false, ...init } = extra;
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    ...init,
    getModifierState: (name: string) => altGr && name === "AltGraph",
  };
};

describe("typedCharacter (LF-17)", () => {
  it("is the character a key types: a letter, a digit, a sign, with Shift too", () => {
    expect(["a", "Z", "7", "?", "é", "😀"].map((key) => typedCharacter(press(key)))).toEqual([
      "a",
      "Z",
      "7",
      "?",
      "é",
      "😀",
    ]);
  });

  it("is none for keys that type nothing, Space, a shortcut, a held key or an input method", () => {
    expect(typedCharacter(press("Enter"))).toBeUndefined();
    expect(typedCharacter(press("ArrowDown"))).toBeUndefined();
    expect(typedCharacter(press(" "))).toBeUndefined();
    expect(typedCharacter(press("d", { ctrlKey: true }))).toBeUndefined();
    expect(typedCharacter(press("d", { metaKey: true }))).toBeUndefined();
    expect(typedCharacter(press("d", { altKey: true }))).toBeUndefined();
    expect(typedCharacter(press("a", { repeat: true }))).toBeUndefined();
    expect(typedCharacter(press("あ", { isComposing: true }))).toBeUndefined();
  });

  it("is the character AltGr types, which Windows reports as Ctrl+Alt", () => {
    expect(typedCharacter(press("@", { ctrlKey: true, altKey: true, altGr: true }))).toBe("@");
  });
});

describe("startEditingOnType (LF-17)", () => {
  let selected: string | null = "heading-1";
  let several = false;
  let stop: () => void = () => undefined;
  /** The keys that reached the page past the canvas's own listener: the app's shortcuts'. */
  let shortcuts: string[] = [];
  const toShortcuts = (event: KeyboardEvent) => shortcuts.push(event.key);

  beforeEach(() => {
    document.body.innerHTML = `
      <div data-puck-component="heading-1"><h2><span contenteditable="false">Hello</span></h2></div>
      <div data-puck-component="section-1"><section><p>Inside</p>
        <div data-puck-component="text-1"><span contenteditable="false">Other</span></div>
      </section></div>
      <input id="field">`;
    selected = "heading-1";
    several = false;
    shortcuts = [];
    window.addEventListener("keydown", toShortcuts);
    stop = startEditingOnType(window, { selected: () => selected, several: () => several });
  });

  afterEach(() => {
    stop();
    window.removeEventListener("keydown", toShortcuts);
    document.body.replaceChildren();
  });

  /** Presses `key` on `target`. */
  const type = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
    );
  };
  /** Presses the pointer on `target`. */
  const press = (target: Element | null, init: PointerEventInit = {}) => {
    target?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, ...init }));
  };

  it("starts editing the selected text, the caret at its end, for the key to type into", () => {
    type("X");

    const field = document.querySelector("span");
    expect(document.activeElement).toBe(field);
    expect(field?.getAttribute("contenteditable")).toBe("plaintext-only");
    const caret = document.getSelection();
    expect(caret?.isCollapsed).toBe(true);
    expect(caret?.anchorOffset).toBe(field?.childNodes.length);
    // The key types there itself; no shortcut sees it.
    expect(shortcuts).toEqual([]);
  });

  it("leaves the key to the shortcuts on an element with no text, or with none selected", () => {
    selected = "section-1";
    type("?");
    selected = null;
    type("?");
    expect(shortcuts).toEqual(["?", "?"]);
    expect(document.activeElement).toBe(document.body);
  });

  it("edits nothing while several elements are selected", () => {
    several = true;
    type("X");
    expect(shortcuts).toEqual(["X"]);
  });

  it("leaves keys that already go to a text field, and those that type nothing", () => {
    const field = document.querySelector("#field");
    if (field === null) throw new Error("no field");
    type("X", field);
    type("Enter");
    type("s", document.body, { ctrlKey: true });
    expect(shortcuts).toEqual(["X", "Enter", "s"]);
  });

  it("makes the selected element's own text editable as it's pressed, for the press's caret", () => {
    const own = document.querySelector('[data-puck-component="heading-1"] span');
    const other = document.querySelector('[data-puck-component="text-1"] span');

    press(other);
    press(own, { ctrlKey: true });
    expect(other?.getAttribute("contenteditable")).toBe("false");
    expect(own?.getAttribute("contenteditable")).toBe("false");
    press(own);
    expect(own?.getAttribute("contenteditable")).toBe("plaintext-only");
  });

  it("stops listening when stopped", () => {
    stop();
    type("X");
    press(document.querySelector("span"));
    expect(shortcuts).toEqual(["X"]);
    expect(document.querySelector("span")?.getAttribute("contenteditable")).toBe("false");
  });
});
