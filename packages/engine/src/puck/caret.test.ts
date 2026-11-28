// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { preserveCaret } from "./caret.js";

function field(text: string): HTMLElement {
  document.body.innerHTML = `<span contenteditable="plaintext-only" tabindex="0">${text}</span>`;
  const element = document.querySelector("span") as HTMLElement;
  element.focus();
  return element;
}

function caretAt(node: Node, offset: number): void {
  document.getSelection()?.collapse(node, offset);
}

const caret = () => {
  const selection = document.getSelection();
  return { node: selection?.focusNode?.textContent, offset: selection?.focusOffset };
};

/** Lets MutationObserver callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("preserveCaret", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("puts the caret back after the field's text is replaced", async () => {
    const element = field("Hello world");
    caretAt(element.firstChild as Node, 5);

    preserveCaret(document);
    element.replaceChildren("Hello there world");
    await flush();

    expect(caret()).toEqual({ node: "Hello there world", offset: 5 });
  });

  it("puts the caret at the end when the new text is shorter", async () => {
    const element = field("Hello world");
    caretAt(element.firstChild as Node, 11);

    preserveCaret(document);
    element.replaceChildren("Hi");
    await flush();

    expect(caret()).toEqual({ node: "Hi", offset: 2 });
  });

  it("does nothing without a focused editable field", async () => {
    document.body.innerHTML = "<p>Text</p>";

    expect(() => preserveCaret(document)).not.toThrow();
    expect(() => preserveCaret(null)).not.toThrow();
  });

  it("leaves rich-text editors alone", async () => {
    document.body.innerHTML =
      '<div class="ProseMirror"><p contenteditable="true" tabindex="0">Rich</p></div>';
    const paragraph = document.querySelector("p") as HTMLElement;
    paragraph.focus();
    caretAt(paragraph.firstChild as Node, 2);

    preserveCaret(document);
    paragraph.replaceChildren("Richer");
    await flush();

    expect(caret().node).not.toBe("Richer");
  });

  it("does nothing when the caret is outside the field", async () => {
    const element = field("Hello");
    document.body.append(document.createTextNode("outside"));
    caretAt(document.body.lastChild as Node, 3);

    preserveCaret(document);
    element.replaceChildren("Changed");
    await flush();

    expect(caret()).toEqual({ node: "outside", offset: 3 });
  });

  /** Types `key` at the caret as a browser does: `beforeinput`, then the text, then the caret. */
  function type(element: HTMLElement, key: string): void {
    element.dispatchEvent(
      new InputEvent("beforeinput", { inputType: "insertText", data: key, bubbles: true }),
    );
    const text = element.firstChild as Text;
    const at = document.getSelection()?.focusOffset ?? text.length;
    text.insertData(at, key);
    caretAt(text, at + key.length);
  }

  it("leaves the caret where the person put it, after a change that didn't draw the field (#1613)", async () => {
    // A click put the caret mid-word as a change that doesn't touch this field came in.
    const element = field("Welcome");
    caretAt(element.firstChild as Node, 4);
    preserveCaret(document);
    await flush();
    // They move it to the end and type: the field changes by their keys, not by the change.
    caretAt(element.firstChild as Node, 7);
    for (const key of " today") {
      type(element, key);
      await flush();
    }

    expect(element.textContent).toBe("Welcome today");
    expect(caret()).toEqual({ node: "Welcome today", offset: 13 });
  });

  it("puts each key after the last, with a change arriving between two keys (#1613)", async () => {
    const element = field("Welcome");
    caretAt(element.firstChild as Node, 7);
    type(element, "!");
    preserveCaret(document);
    await flush();
    type(element, "?");
    await flush();
    type(element, "!");
    await flush();

    expect(element.textContent).toBe("Welcome!?!");
  });

  it("still puts the caret back for the key making the change, as Ctrl+Z is (#1613)", async () => {
    const element = field("Hello world");
    caretAt(element.firstChild as Node, 5);
    // The change is made while its own keydown is still under way, by a handler above the field
    // that sees it first: that key, reaching the field next, isn't the person's next act.
    document.addEventListener("keydown", () => preserveCaret(document), {
      once: true,
      capture: true,
    });
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    element.replaceChildren("Hello there world");
    await flush();

    expect(caret()).toEqual({ node: "Hello there world", offset: 5 });
  });

  it("lets the caret be once the person leaves the field (#1613)", async () => {
    const element = field("Hello world");
    caretAt(element.firstChild as Node, 5);
    preserveCaret(document);
    await flush();
    element.dispatchEvent(new FocusEvent("focusout"));
    caretAt(element.firstChild as Node, 11);
    (element.firstChild as Text).appendData("!");
    caretAt(element.firstChild as Node, 12);
    await flush();

    expect(caret()).toEqual({ node: "Hello world!", offset: 12 });
  });
});
