// @vitest-environment happy-dom

import { useDragDropManager } from "@dnd-kit/react";
import { type Config, createUsePuck, Puck, useGetPuck } from "@puckeditor/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { puckPrivateApi } from "./puck-dom.js";

// Our Puck patch (`patches/@puckeditor__core@<version>.patch`), item by item as ADR 0007 lists
// them, against Puck as it is installed (A9): a Puck upgrade that loses one fails here, by name.
//   1. No whole-page permissions walk when nothing resolves permissions: below.
//   2. No new fields object for an unchanged selected element: below.
//   3. `__private.getZoomConfig` and `setZoomConfig`: below; zooming in puck-engine.test.tsx.
//   4. The zoom re-fits only on a real resize: puck-engine.test.tsx (#134).
//   5. Rich text sent as its editor loses focus: rich-text-flush.test.tsx.
//   6. `__private.flushRichText`: below; sending in rich-text-flush.test.tsx (#146).
//   7. The inline rich-text editor loaded with the canvas: rich-text-eager.test.tsx, a file of its
//      own so that no other test has loaded the editor first.
//   8. Whether a zone accepts what's dragged, read by the drag library as it asks: below.
//   9. An element's active zones, read by the drag library as it asks: below.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** How many elements the page has: the walk reads each one's config, the patched check none. */
const ELEMENTS = 30;

/**
 * Puck's canvas starts a 500 ms timer as it mounts, and its end re-renders the canvas: each test
 * counts from past it, however slow a loaded machine makes the mount.
 */
const CANVAS_TIMER_MS = 600;

/** Lets Puck's effects and deferred dispatches run. */
async function settle(ms = 30): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

const usePuck = createUsePuck();

/**
 * Puck on a page of {@link ELEMENTS} headings, with what the test reads of it: how often the
 * heading's `resolvePermissions` is looked up, Puck's API, and how often a store selector runs.
 */
async function mounted() {
  const counts = { permissionLookups: 0, selectorRuns: 0 };
  let api: ReturnType<ReturnType<typeof useGetPuck>> | undefined;
  function Probe({ children }: { readonly children: ReactNode }) {
    api = useGetPuck()();
    usePuck((state) => {
      counts.selectorRuns += 1;
      return state.appState.data;
    });
    return <>{children}</>;
  }
  const heading = {
    fields: { text: { type: "text" as const } },
    render: ({ text }: { readonly text: string }) => <h2>{text}</h2>,
    // Puck reads it for each element as it resolves permissions: none here.
    get resolvePermissions() {
      counts.permissionLookups += 1;
      return undefined;
    },
  };
  const config = { components: { Heading: heading } } as unknown as Config;
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  await act(async () => {
    root.render(
      <Puck
        config={config}
        data={{
          root: { props: {} },
          content: Array.from({ length: ELEMENTS }, (_, n) => ({
            type: "Heading",
            props: { id: `h${n}`, text: `Heading ${n}` },
          })),
        }}
        overrides={{ puck: Probe }}
        iframe={{ enabled: false }}
      />,
    );
  });
  await settle(CANVAS_TIMER_MS);
  /** Replaces element `index` with new text, as a keystroke in it does. */
  const replace = async (index: number, text: string) => {
    await act(async () => {
      api?.dispatch({
        type: "replace",
        destinationIndex: index,
        destinationZone: "root:default-zone",
        data: { type: "Heading", props: { id: `h${index}`, text } },
      });
    });
    await settle();
  };
  const select = async (index: number) => {
    await act(async () => {
      api?.dispatch({
        type: "setUi",
        ui: { itemSelector: { index, zone: "root:default-zone" } },
      });
    });
    await settle();
  };
  const unmount = async () => {
    await act(async () => root.unmount());
    element.remove();
  };
  return { counts, replace, select, unmount, api: () => api };
}

/** What the drag library knows of an element: its collision data, as Puck gives it. */
type DragData = { readonly inDroppableZone: boolean; readonly containsActiveZone: boolean };

/**
 * Puck on a page of a heading and a card whose slot takes only text, with one text in it: the
 * drag library's manager, and each element's collision data as the library reads it.
 */
async function mountedWithSlot() {
  // The drag library's feedback waits for the page's animations, which happy-dom doesn't list.
  document.getAnimations ??= () => [];
  let manager: ReturnType<typeof useDragDropManager> | undefined;
  function Probe({ children }: { readonly children: ReactNode }) {
    manager = useDragDropManager();
    return <>{children}</>;
  }
  const text = { fields: { text: { type: "text" as const } } };
  const config = {
    components: {
      Heading: {
        ...text,
        render: ({ text: words }: { readonly text: string }) => <h2>{words}</h2>,
      },
      Text: { ...text, render: ({ text: words }: { readonly text: string }) => <p>{words}</p> },
      Card: {
        fields: { items: { type: "slot", allow: ["Text"] } },
        render: ({ items: Items }: { readonly items: () => ReactNode }) => (
          <div>
            <Items />
          </div>
        ),
      },
    },
  } as unknown as Config;
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  await act(async () => {
    root.render(
      <Puck
        config={config}
        data={{
          root: { props: {} },
          content: [
            { type: "Heading", props: { id: "h0", text: "Fresh bread" } },
            {
              type: "Card",
              props: { id: "c0", items: [{ type: "Text", props: { id: "t0", text: "Daily" } }] },
            },
          ],
        }}
        overrides={{ puck: Probe }}
        iframe={{ enabled: false }}
      />,
    );
  });
  await settle(CANVAS_TIMER_MS);
  const data = (id: string) =>
    manager?.registry.draggables.get(id)?.data as (DragData & Record<string, unknown>) | undefined;
  const unmount = async () => {
    await act(async () => root.unmount());
    element.remove();
  };
  return { data, manager: () => manager, unmount };
}

describe("our Puck patch (ADR 0007, A9)", () => {
  it("1. walks no page for permissions when nothing resolves them", async () => {
    const puck = await mounted();
    const before = puck.counts.permissionLookups;

    await puck.replace(3, "Changed");

    // The patched check reads the config's one heading once; the walk reads it for every element.
    expect(puck.counts.permissionLookups - before).toBeLessThan(ELEMENTS / 2);
    await puck.unmount();
  });

  it("2. publishes no new fields for a selected element whose fields haven't changed", async () => {
    const puck = await mounted();
    await puck.select(0);

    // A change to another element runs the selector as a change does.
    const beforeOther = puck.counts.selectorRuns;
    await puck.replace(5, "Elsewhere");
    const other = puck.counts.selectorRuns - beforeOther;
    // A change to the selected one runs it as often: its fields are the same, so no extra pass.
    const beforeSelected = puck.counts.selectorRuns;
    await puck.replace(0, "Typed");
    const selected = puck.counts.selectorRuns - beforeSelected;

    expect(other).toBeGreaterThan(0);
    expect(selected).toBe(other);
    await puck.unmount();
  });

  it("3 and 6. gives the canvas zoom and the rich-text flush through Puck's private API", async () => {
    const puck = await mounted();

    const api = puckPrivateApi(puck.api());

    expect(typeof api?.getZoomConfig().zoom).toBe("number");
    expect(typeof api?.setZoomConfig).toBe("function");
    expect(api?.flushRichText()).toBe(false);
    await puck.unmount();
  });

  it("8. answers whether a zone accepts what's dragged as the drag library asks (#786)", async () => {
    const puck = await mountedWithSlot();
    const inCard = () => puck.data("t0")?.inDroppableZone;
    // Read when asked, not a prop: a prop flipped at each drag's start and end drew every element
    // of the page again.
    expect(Object.getOwnPropertyDescriptor(puck.data("t0"), "inDroppableZone")?.get).toBeTypeOf(
      "function",
    );
    expect(inCard()).toBe(true);

    // A heading picked up: the card's slot takes only text. The answer is there at once, before
    // React has drawn anything again.
    puck.manager()?.actions.start({ source: "h0", coordinates: { x: 0, y: 0 } });
    expect(inCard()).toBe(false);
    expect(puck.data("c0")?.inDroppableZone).toBe(true);
    await puck.unmount();
  });

  it("9. answers whether an element holds an active zone as the drag library asks (#786)", async () => {
    const puck = await mountedWithSlot();
    // Kept out of React's state: setting it drew every element holding a zone again per drag.
    expect(Object.getOwnPropertyDescriptor(puck.data("c0"), "containsActiveZone")?.get).toBeTypeOf(
      "function",
    );
    expect(puck.data("c0")?.containsActiveZone).toBe(true);
    expect(puck.data("h0")?.containsActiveZone).toBe(false);
    // A heading picked up: the card's slot isn't a place for it, so the card holds no active zone.
    puck.manager()?.actions.start({ source: "h0", coordinates: { x: 0, y: 0 } });
    await settle();
    expect(puck.data("c0")?.containsActiveZone).toBe(false);
    await puck.unmount();
  });
});
