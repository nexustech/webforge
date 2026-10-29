// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import type { NodeDoc, SharedSectionId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { SITE_CSS_DEBOUNCE_MS } from "../editor/site-css.js";
import {
  createItemPreviews,
  createKindPreviews,
  createSectionPreviews,
} from "./section-preview.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const HOURS = "shared-hours" as SharedSectionId;
const { theme } = starterSite();
/** The section "Opening hours" stores: the same object until it is edited, as in the document. */
const HOURS_SECTION: NodeDoc = {
  type: "Section",
  props: { id: "s", content: [{ type: "Heading", props: { id: "t", text: "Opening hours" } }] },
};

function setUp(status: "compiled" | "failed" = "compiled") {
  const compileCss = vi.fn(async () =>
    status === "compiled"
      ? {
          status,
          css: '@font-face {\n  font-family: "Inter";\n  src: url("webforge-font:inter-latin-400-normal.woff2");\n}\n.wf-hero{color:red}',
          bodyClass: "flex min-h-screen flex-col bg-base-100 font-sans text-base-content",
        }
      : { status },
  );
  const previews = createSectionPreviews({
    library: siteLibrary,
    theme: () => theme,
    sharedSection: (id) => (id === HOURS ? HOURS_SECTION : undefined),
    compileCss,
  });
  return { previews, compileCss };
}

/** Shows `node` and waits for its drawing; the preview's shadow root, if it drew one. */
async function shown(node: ReturnType<ReturnType<typeof createSectionPreviews>>) {
  const { container } = render(<>{node}</>);
  await act(async () => undefined);
  // Theme Studio's are in a box of their size (#626): the drawing's host is inside it.
  return [...container.querySelectorAll("div")].find((each) => each.shadowRoot)?.shadowRoot ?? null;
}

describe("createSectionPreviews (UX-10)", () => {
  it("draws a section with its defaults and the CSS its classes need, in a shadow root", async () => {
    const { previews, compileCss } = setUp();

    const root = await shown(previews({ type: "Hero", label: "Hero", category: "Heroes" }));

    expect(root?.querySelector("style")?.textContent).toContain(".wf-hero{color:red}");
    // In the site's theme, with the page's colours and font but not its whole-page layout.
    const page = root?.querySelector<HTMLElement>(".wf-preview");
    expect(page?.dataset.theme).toBe(theme.preset);
    expect(page?.className).toBe("wf-preview bg-base-100 font-sans text-base-content");
    // Font faces are declared for the editor window: a shadow root's own are ignored.
    expect(root?.querySelector("style")?.textContent).not.toContain("@font-face");
    const fonts = document.head.querySelector("style[data-webforge-preview-fonts]");
    expect(fonts?.textContent).toMatch(/^@font-face \{ font-family: "Inter";.*\}$/);
    expect(root?.querySelector(".wf-preview")?.innerHTML).not.toBe("");
    expect(compileCss).toHaveBeenCalledWith(
      expect.objectContaining({ theme, candidates: expect.any(Array) }),
    );
  });

  it("draws a shared section as the site holds it, and each one once", async () => {
    const { previews, compileCss } = setUp();
    const item = {
      type: HOURS,
      label: "Hours",
      category: "Shared sections",
      sharedSectionId: HOURS,
    };

    await shown(previews(item));
    cleanup();
    const root = await shown(previews(item));

    expect(root?.querySelector(".wf-preview")?.textContent).toContain("Opening hours");
    expect(compileCss).toHaveBeenCalledTimes(1);
  });

  it("draws a section once, and again once the theme has changed", async () => {
    let current = theme;
    const compileCss = vi.fn(async () => ({
      status: "compiled" as const,
      css: "",
      bodyClass: "",
    }));
    const previews = createSectionPreviews({
      library: siteLibrary,
      theme: () => current,
      sharedSection: () => undefined,
      compileCss,
    });
    const hero = { type: "Hero", label: "Hero", category: "Heroes" };

    await shown(previews(hero));
    cleanup();
    await shown(previews(hero));
    expect(compileCss).toHaveBeenCalledTimes(1);

    current = { ...theme };
    cleanup();
    await shown(previews(hero));
    expect(compileCss).toHaveBeenCalledTimes(2);
  });

  it("has none for an element, a shared section gone, or CSS that failed", async () => {
    const { previews } = setUp("failed");

    expect(previews({ type: "Heading", label: "Heading", category: "Text" })).toBeNull();
    expect(
      previews({
        type: "shared-gone",
        label: "Gone",
        category: "Shared sections",
        sharedSectionId: "shared-gone" as SharedSectionId,
      }),
    ).toBeNull();
    expect(await shown(previews({ type: "Hero", label: "Hero", category: "Heroes" }))).toBeNull();
  });
});

describe("createKindPreviews (3.12, CT-1)", () => {
  it("draws an element too, with its kind's look, and again once the theme changes", async () => {
    let current = { ...theme, looks: { Button: { lookCorners: "full" } } };
    const compileCss = vi.fn(async () => ({ status: "compiled" as const, css: "", bodyClass: "" }));
    const previews = createKindPreviews({ library: siteLibrary, theme: () => current, compileCss });

    const root = await shown(previews("Button"));
    expect(root?.querySelector(".wf-preview")?.innerHTML).toContain("rounded-full!");

    current = { ...current, looks: { Button: { lookCorners: "none" } } };
    cleanup();
    const again = await shown(previews("Button"));
    expect(again?.querySelector(".wf-preview")?.innerHTML).toContain("rounded-none!");
    expect(compileCss).toHaveBeenCalledTimes(2);
  });

  it("takes its whole size before it's drawn, so what follows it doesn't move (#626)", async () => {
    let finish: (value: { status: "compiled"; css: string; bodyClass: string }) => void = () =>
      undefined;
    const compileCss = vi.fn(
      () =>
        new Promise<{ status: "compiled"; css: string; bodyClass: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const previews = createKindPreviews({ library: siteLibrary, theme: () => theme, compileCss });
    const { container } = render(<>{previews("Features")}</>);
    const box = () => container.querySelector<HTMLElement>("[data-kind-preview]");

    // Not drawn yet: its place is the preview's whole size already.
    expect(box()?.style.height).toBe("200px");
    expect(box()?.style.width).toBe("320px");
    await act(async () => finish({ status: "compiled", css: "", bodyClass: "" }));

    expect([...(box()?.querySelectorAll("div") ?? [])].some((each) => each.shadowRoot)).toBe(true);
    expect(box()?.style.height).toBe("200px");
  });

  it("draws a preview that stays shown again when the look changes (#613)", async () => {
    let current = { ...theme, looks: { Button: { lookCorners: "full" } } };
    const listeners = new Set<() => void>();
    const compileCss = vi.fn(async () => ({ status: "compiled" as const, css: "", bodyClass: "" }));
    const previews = createKindPreviews({
      library: siteLibrary,
      theme: () => current,
      compileCss,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
    const root = await shown(previews("Button"));
    expect(root?.querySelector(".wf-preview")?.innerHTML).toContain("rounded-full!");

    // As Theme Studio's Components does: the same preview, shown on, while the look changes.
    current = { ...current, looks: { Button: { lookCorners: "none" } } };
    await act(async () => {
      for (const listener of listeners) listener();
    });
    await act(async () => undefined);

    expect(root?.querySelector(".wf-preview")?.innerHTML).toContain("rounded-none!");
    expect(compileCss).toHaveBeenCalledTimes(2);
    // Other changes to the site draw nothing again.
    await act(async () => {
      for (const listener of listeners) listener();
    });
    expect(compileCss).toHaveBeenCalledTimes(2);
  });

  it("draws nothing for a type the library doesn't have", async () => {
    const compileCss = vi.fn();
    const previews = createKindPreviews({ library: siteLibrary, theme: () => theme, compileCss });

    expect(await shown(previews("Nothing"))).toBeNull();
    expect(compileCss).not.toHaveBeenCalled();
  });
});

/** Lets `ms` pass, and what it set going. */
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("createItemPreviews (3.13a)", () => {
  it("draws the item as it is, at each device's width, in a frame that runs no scripts", async () => {
    const { compileCss } = setUp();
    const previews = createItemPreviews({ library: siteLibrary, theme: () => theme, compileCss });
    const button: NodeDoc = { type: "Button", props: { id: "b", label: "Book now", link: "" } };

    const { container, rerender } = render(<>{previews(button, "mobile")}</>);
    await wait(0);
    const frame = () => container.querySelector("iframe");

    expect(frame()?.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame()?.style.width).toBe("375px");
    const page = frame()?.getAttribute("srcdoc") ?? "";
    expect(page).toContain("Book now");
    expect(page).toContain(".wf-hero{color:red}");
    // Its own font faces: a frame is a document of its own.
    expect(page).toContain("@font-face");
    expect(page).toContain(`data-theme="${theme.preset}"`);

    // Drawn again once the change has settled, as the site CSS is.
    rerender(
      <>{previews({ ...button, props: { ...button.props, label: "Call us" } }, "mobile")}</>,
    );
    await wait(0);
    expect(frame()?.getAttribute("srcdoc")).toContain("Book now");
    await wait(SITE_CSS_DEBOUNCE_MS + 20);
    expect(frame()?.getAttribute("srcdoc")).toContain("Call us");
    expect(compileCss).toHaveBeenCalledTimes(2);
  });

  it("draws both devices from one compile of the item as it is (3.13a review)", async () => {
    const { compileCss } = setUp();
    const previews = createItemPreviews({ library: siteLibrary, theme: () => theme, compileCss });
    const button: NodeDoc = { type: "Button", props: { id: "b", label: "Book now", link: "" } };

    const { container } = render(
      <>
        {previews(button, "desktop")}
        {previews(button, "mobile")}
      </>,
    );
    await wait(0);

    expect(container.querySelectorAll("iframe")).toHaveLength(2);
    expect(container.querySelector("iframe")?.style.width).toBe("1280px");
    expect(compileCss).toHaveBeenCalledOnce();
  });
});
