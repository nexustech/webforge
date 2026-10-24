import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";

// The "lightbox" behaviour (2.7a) on a Gallery as the export renders it.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** Image `id` as the export resolves it: its full-size file is `assets/img/<id>-1600.jpg`. */
const resolved = (id: string): ResolvedImage => ({
  sources: [
    {
      type: "image/webp",
      srcset: `assets/img/${id}-640.webp 640w, assets/img/${id}-1600.webp 1600w`,
    },
  ],
  src: `assets/img/${id}-1600.jpg`,
  fallback: { type: "image/jpeg", srcset: `assets/img/${id}-640.jpg 640w` },
  width: 1600,
  height: 1200,
  alt: `Photo ${id}`,
});
const context: RenderContext = { ...EDITOR_RENDER_CONTEXT, image: resolved };

const image = (id: string, caption = ""): NodeDoc => ({
  type: "GalleryImage",
  props: { id, image: { mediaId: id }, caption },
});

/** A page of its own with a Gallery of `ids`, and `lightbox.js` run on it. */
function page(ids = ["a", "b", "c"]) {
  const happy = new Window({ width: 1024, height: 768 });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = `<button id="before">Before</button>${renderNodesToHtml(
    [
      {
        type: "Gallery",
        props: {
          id: "gallery",
          title: "Our work",
          images: ids.map((id, index) => image(id, index === 1 ? "Our oven" : "")),
        },
      },
    ],
    siteLibrary,
    context,
  )}`;
  new Function(
    "document",
    "window",
    "HTMLDialogElement",
    "HTMLImageElement",
    "HTMLAnchorElement",
    "HTMLElement",
    BEHAVIOUR_SCRIPTS.lightbox ?? "",
  )(
    document,
    window,
    window.HTMLDialogElement,
    window.HTMLImageElement,
    window.HTMLAnchorElement,
    window.HTMLElement,
  );
  const dialog = document.querySelector<HTMLDialogElement>("dialog[data-wf-lightbox]");
  const items = [...document.querySelectorAll<HTMLAnchorElement>("a[data-wf-lightbox-item]")];
  const shown = () => document.querySelector<HTMLImageElement>("[data-wf-lightbox-image]");
  const text = (selector: string) => document.querySelector(selector)?.textContent;
  const button = (name: string) => {
    const found = dialog?.querySelector<HTMLButtonElement>(`[data-wf-lightbox-${name}]`);
    if (found == null) throw new Error(`No ${name} button`);
    return found;
  };
  return { window, document, dialog, items, shown, text, button };
}

describe("the lightbox behaviour (2.7a)", () => {
  it("opens the image clicked large, with its caption, and says which it is", () => {
    const { dialog, items, shown, text, window } = page();

    const click = new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    items[1]?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(dialog?.open).toBe(true);
    expect(shown()?.getAttribute("src")).toBe("assets/img/b-1600.jpg");
    expect(shown()?.alt).toBe("Photo b");
    expect(text("[data-wf-lightbox-caption]")).toBe("Our oven");
    expect(text("[data-wf-lightbox-status]")).toBe("2 of 3");
  });

  it("goes through the images with its buttons and the arrow keys, round past either end", () => {
    const { items, shown, text, button, dialog, window } = page();
    items[0]?.click();

    button("previous").click();
    expect(shown()?.getAttribute("src")).toBe("assets/img/c-1600.jpg");
    expect(text("[data-wf-lightbox-status]")).toBe("3 of 3");
    button("next").click();
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
    dialog?.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(text("[data-wf-lightbox-status]")).toBe("2 of 3");
    dialog?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
    // Alt+Left is the browser's Back.
    dialog?.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }),
    );
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
  });

  it("moves with a swipe, not with a mouse drag", () => {
    const { items, text, dialog, window } = page();
    items[0]?.click();
    const swipe = (from: number, to: number, pointerType = "touch") => {
      dialog?.dispatchEvent(new window.PointerEvent("pointerdown", { clientX: from, pointerType }));
      dialog?.dispatchEvent(new window.PointerEvent("pointerup", { clientX: to, pointerType }));
    };

    swipe(300, 100);
    expect(text("[data-wf-lightbox-status]")).toBe("2 of 3");
    swipe(100, 300);
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
    swipe(100, 130);
    swipe(300, 100, "mouse");
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
  });

  it("gives the focus back to the image clicked when it closes", () => {
    const { items, dialog, document } = page();
    items[2]?.focus();
    items[2]?.click();

    dialog?.close();

    expect(document.activeElement).toBe(items[2]);
  });

  it("leaves a click with a modifier to the browser: the file in a new tab", () => {
    const { items, dialog, window } = page();

    const click = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    items[0]?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(dialog?.open).toBe(false);
  });

  it("hides its buttons for one image: there's nowhere to go", () => {
    const { button } = page(["a"]);

    expect(button("previous").hidden).toBe(true);
    expect(button("next").hidden).toBe(true);
  });

  it("shows the large image from its own sources, as wide as the screen", () => {
    const { items, document } = page();
    items[1]?.click();

    const picture = document.querySelector("[data-wf-lightbox-picture]");
    const sources = [...(picture?.querySelectorAll("source") ?? [])];
    expect(
      sources.map((source) => [source.getAttribute("srcset"), source.getAttribute("sizes")]),
    ).toEqual([["assets/img/b-640.webp 640w, assets/img/b-1600.webp 1600w", "100vw"]]);
    const shown = document.querySelector<HTMLImageElement>("[data-wf-lightbox-image]");
    expect(shown?.getAttribute("srcset")).toBe("assets/img/b-640.jpg 640w");
    expect(shown?.getAttribute("sizes")).toBe("100vw");
    // The next image replaces them, not adds to them.
    items[2]?.click();
    expect(picture?.querySelectorAll("source")).toHaveLength(1);
  });

  it("goes to the first and last image with Home and End, with the focus left on the page too", () => {
    const { items, text, dialog, document, window } = page();
    const press = (key: string) =>
      document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
    items[1]?.click();

    // After a click Safari leaves the focus on the page, not in the dialog.
    press("End");
    expect(text("[data-wf-lightbox-status]")).toBe("3 of 3");
    press("Home");
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
    // Closed, the keys are the page's again.
    dialog?.close();
    press("End");
    expect(text("[data-wf-lightbox-status]")).toBe("1 of 3");
  });
});
