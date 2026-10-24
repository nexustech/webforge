import type { Locator } from "@playwright/test";

// Moving the caret without Home and End, which scroll on macOS and leave the caret where it is
// (#287): a text field through its selection range, editable text through the Selection API.
// Each waits two frames after, as an editor (ProseMirror) takes a new selection on
// `selectionchange`, which comes later: keys pressed before then would act on the old one.

/** Puts the caret at the start or the end of the text in `editor`, a text field or editable text. */
export async function placeCaret(editor: Locator, at: "start" | "end"): Promise<void> {
  await select(editor, at);
}

/** Selects all of the text in `editor`, as Home then Shift+End does elsewhere. */
export async function selectText(editor: Locator): Promise<void> {
  await select(editor, "all");
}

async function select(editor: Locator, what: "start" | "end" | "all"): Promise<void> {
  await editor.evaluate(async (element, which) => {
    const view = element.ownerDocument.defaultView;
    const settled = () =>
      new Promise<void>((resolve) => {
        if (view === null) resolve();
        else view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve()));
      });
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      const end = field.value.length;
      field.setSelectionRange(which === "end" ? end : 0, which === "start" ? 0 : end);
      await settled();
      return;
    }
    const document = element.ownerDocument;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let first: Node | null = null;
    let last: Node | null = null;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      first ??= node;
      last = node;
    }
    if (first === null || last === null) {
      return;
    }
    const start = which === "end" ? last : first;
    const end = which === "start" ? first : last;
    document
      .getSelection()
      ?.setBaseAndExtent(
        start,
        which === "end" ? (start.textContent ?? "").length : 0,
        end,
        which === "start" ? 0 : (end.textContent ?? "").length,
      );
    await settled();
  }, what);
}
