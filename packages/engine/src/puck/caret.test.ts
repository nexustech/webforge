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
});
