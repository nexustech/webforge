// @vitest-environment happy-dom

import { type Config, type Data, Puck, useGetPuck } from "@puckeditor/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";

// Our Puck patch's `__private.flushRichText` (ADR 0004 item 7, #146, #307), against a mounted Puck:
// a Puck upgrade that loses the patch, or re-applies it wrongly, fails here and not only in E2E.

type GetPuck = ReturnType<typeof useGetPuck>;

/** What the test needs of the Tiptap editor, which keeps itself on its `.ProseMirror` element. */
type TypingEditor = {
  readonly state: { readonly doc: { readonly content: { readonly size: number } } };
  readonly commands: { insertContentAt(at: number, text: string): boolean };
  getHTML(): string;
};

/** Types `text` at the end of the editor's text, as a keystroke would. */
const typeAtEnd = (editor: TypingEditor, text: string) =>
  editor.commands.insertContentAt(editor.state.doc.content.size - 1, text);

const config: Config = {
  components: {
    Text: {
      fields: { body: { type: "richtext", contentEditable: true } },
      render: ({ body }) => <div className="t-text">{body}</div>,
    },
  },
};

const data: Data = {
  root: { props: {} },
  content: [{ type: "Text", props: { id: "t", body: "<p>Tell visitors what you do.</p>" } }],
};

let root: Root | undefined;
let element: HTMLDivElement | undefined;

afterEach(async () => {
  await act(async () => root?.unmount());
  element?.remove();
});

/** Waits for promises only: no timers, so React renders nothing it has scheduled. */
async function microtasks(): Promise<void> {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
}

const bodyOf = (getPuck: GetPuck) => getPuck().appState.data.content[0]?.props.body;

it("sends the rich text the editor hasn't sent on at once, without waiting for React (#307)", async () => {
  element = document.createElement("div");
  document.body.append(element);
  let getPuck: GetPuck | undefined;
  function Capture() {
    getPuck = useGetPuck();
    return null;
  }
  await act(async () => {
    root = createRoot(element as HTMLDivElement);
    root.render(
      <Puck config={config} data={data} iframe={{ enabled: false }}>
        <Puck.Preview />
        <Capture />
      </Puck>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const puck = getPuck;
  const editable = element.querySelector(".ProseMirror") as
    | (HTMLElement & { editor?: TypingEditor })
    | null;
  if (puck === undefined || editable?.editor === undefined) throw new Error("No rich-text editor");
  const tiptap = editable.editor;
  // Typing in it: the editor sends changes on while its field has the focus, and Puck knows it as
  // the rich text being edited once it is focused.
  await act(async () => {
    editable.focus();
    // Puck's name for the inline editor of the field `body`.
    puck().dispatch({ type: "setUi", ui: { field: { focus: "body::inline" } } });
    puck().dispatch({
      type: "setUi",
      ui: { itemSelector: { index: 0, zone: "root:default-zone" } },
    });
  });
  expect(bodyOf(puck)).toBe("<p>Tell visitors what you do.</p>");

  // Two keystrokes outside React's turn: the first goes to React's state at once, the second waits
  // in Puck's debounce. Neither has reached Puck's data, as React hasn't rendered.
  typeAtEnd(tiptap, " Indeed");
  typeAtEnd(tiptap, ".");
  expect(tiptap.getHTML()).toBe("<p>Tell visitors what you do. Indeed.</p>");
  expect(bodyOf(puck)).toBe("<p>Tell visitors what you do.</p>");

  const flush = (puck() as { __private?: { flushRichText?: () => boolean } }).__private
    ?.flushRichText;
  expect(flush?.()).toBe(true);
  await microtasks();

  expect(bodyOf(puck)).toBe("<p>Tell visitors what you do. Indeed.</p>");
  // All of it is on its way: nothing is left to send, and React doesn't send it again.
  expect(flush?.()).toBe(false);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(bodyOf(puck)).toBe("<p>Tell visitors what you do. Indeed.</p>");
});
