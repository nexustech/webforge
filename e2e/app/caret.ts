import type { Locator } from "@playwright/test";

/**
 * Puts the caret at the start or the end of the text in `editor`, an editable element, through
 * the Selection API. Not with Home or End: on macOS they scroll and leave the caret where it is
 * (#287).
 */
export async function placeCaret(editor: Locator, at: "start" | "end"): Promise<void> {
  await editor.evaluate((element, where) => {
    const document = element.ownerDocument;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let first: Node | null = null;
    let last: Node | null = null;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      first ??= node;
      last = node;
    }
    const node = where === "start" ? first : last;
    if (node !== null) {
      document
        .getSelection()
        ?.collapse(node, where === "start" ? 0 : (node.textContent ?? "").length);
    }
  }, at);
}
