// @vitest-environment happy-dom
import type { Editor } from "@tiptap/core";
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorState } from "./editor-state.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** An editor whose state is a counter, changed (with a `transaction`) by `change`. */
function fakeEditor() {
  const listeners = new Set<() => void>();
  const fake = {
    state: { changes: 0 },
    on: (_event: string, listener: () => void) => listeners.add(listener),
    off: (_event: string, listener: () => void) => listeners.delete(listener),
  };
  const change = () => {
    fake.state = { changes: fake.state.changes + 1 };
    for (const listener of listeners) listener();
  };
  return { editor: fake as unknown as Editor, change, listeners };
}

/** Shows how many changes the toolbar has seen. */
function Probe({ editor }: { readonly editor: Editor | null }) {
  const state = useEditorState(editor) as unknown as { changes: number } | null;
  return <p>{state === null ? "none" : state.changes}</p>;
}

/** Changes the editor after the toolbar is drawn and before its effects run (#357's gap). */
function ChangeBeforeEffects({ change }: { readonly change: () => void }) {
  useLayoutEffect(() => change(), [change]);
  return null;
}

describe("useEditorState (#357)", () => {
  let root: Root;
  let host: HTMLDivElement;
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });
  const mount = (children: React.ReactNode) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(children));
  };

  it("sees a change made between drawing and subscribing", () => {
    const { editor, change } = fakeEditor();

    mount(
      <>
        <Probe editor={editor} />
        <ChangeBeforeEffects change={change} />
      </>,
    );

    expect(host.textContent).toBe("1");
  });

  it("draws again on each later change, and stops listening once gone", () => {
    const { editor, change, listeners } = fakeEditor();
    mount(<Probe editor={editor} />);

    act(change);
    act(change);
    expect(host.textContent).toBe("2");
    act(() => root.render(<Probe editor={null} />));

    expect(host.textContent).toBe("none");
    expect(listeners.size).toBe(0);
  });
});
