import { componentSelector, RICH_TEXT } from "./puck-dom.js";

/** Text offset of the caret inside `element`, or `null` if the selection is elsewhere. */
function caretOffset(element: HTMLElement): number | null {
  const selection = element.ownerDocument.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.focusNode === null) {
    return null;
  }
  if (!element.contains(selection.focusNode)) {
    return null;
  }
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.setEnd(selection.focusNode, selection.focusOffset);
  return range.toString().length;
}

/** Puts the caret `offset` characters into `element`'s text, or at its end. */
function placeCaret(element: HTMLElement, offset: number): void {
  const doc = element.ownerDocument;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  for (
    let node = walker.nextNode() as Text | null;
    node !== null;
    node = walker.nextNode() as Text | null
  ) {
    last = node;
    if (remaining <= node.length) {
      doc.getSelection()?.collapse(node, remaining);
      return;
    }
    remaining -= node.length;
  }
  doc.getSelection()?.collapse(last ?? element, last?.length ?? 0);
}

/** How long to wait for the field to re-render before giving up. */
const RESTORE_TIMEOUT_MS = 1_000;

/**
 * Keeps the caret where it is in a focused plain-text inline field of `doc` while its text is
 * replaced. Puck's inline text field swaps its text node when the value changes from outside (undo
 * while typing), which would otherwise move the caret to the start. Call it just before the change;
 * the caret is put back as soon as the field's content changes, before the next key press.
 * Rich text (ProseMirror) restores its own selection and is left alone.
 */
export function preserveCaret(doc: Document | null): void {
  // The field lives in the canvas iframe, so `instanceof HTMLElement` (the host's) cannot be used.
  const active = doc?.activeElement as HTMLElement | null | undefined;
  const MutationObserverImpl = doc?.defaultView?.MutationObserver;
  if (
    !active?.isContentEditable ||
    active.closest(RICH_TEXT) !== null ||
    MutationObserverImpl === undefined
  ) {
    return;
  }
  const offset = caretOffset(active);
  if (offset === null) {
    return;
  }
  const observer = new MutationObserverImpl(() => {
    observer.disconnect();
    placeCaret(active, offset);
  });
  observer.observe(active, { childList: true, characterData: true, subtree: true });
  setTimeout(() => observer.disconnect(), RESTORE_TIMEOUT_MS);
}

/**
 * Puts the focus, and the caret at the same place in the text (or the end, if the text is now
 * shorter), back into the rich-text editor of node `id` once it has been remounted: Undo or Redo
 * pressed while typing in it remounts it to show the new value (see `staleRichText`), which would
 * otherwise leave the person typing into nothing. Call it just before the change.
 */
export function refocusRichText(doc: Document | null, id: string): void {
  const MutationObserverImpl = doc?.defaultView?.MutationObserver;
  if (doc == null || MutationObserverImpl === undefined) {
    return;
  }
  const selector = `${componentSelector(id)} ${RICH_TEXT}`;
  const before = doc.querySelector<HTMLElement>(selector);
  const offset = (before === null ? null : caretOffset(before)) ?? Number.MAX_SAFE_INTEGER;
  const observer = new MutationObserverImpl(() => {
    const editor = doc.querySelector<HTMLElement>(selector);
    if (editor !== null && editor !== before) {
      observer.disconnect();
      clearTimeout(timer);
      editor.focus();
      placeCaret(editor, offset);
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  const timer = setTimeout(() => observer.disconnect(), RESTORE_TIMEOUT_MS);
}
