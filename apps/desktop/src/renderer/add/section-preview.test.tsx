// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import type { NodeDoc, SharedSectionId } from "@webforge/model";
import { renderNodesToHtml, siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { SITE_CSS_DEBOUNCE_MS } from "../editor/site-css.js";
import {
  createItemPreviews,
  createSectionPreviews,
  previewContext,
  showsAnything,
} from "./section-preview.js";

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
  const { container } = render(node);
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

describe("the Add panel's previews as the section looks once filled in (#1175)", () => {
  /** A section as its preview draws it: its defaults and sample, with sample site details. */
  const sampled = (type: string) => {
    const definition = siteLibrary.components[type];
    if (definition === undefined) throw new Error(`no ${type}`);
    const node: NodeDoc = {
      type,
      props: { ...definition.defaults, ...(definition.sample ?? {}), id: "preview" },
    };
    const page = document.createElement("div");
    page.innerHTML = renderNodesToHtml([node], siteLibrary, previewContext());
    return page;
  };
  const sections = Object.entries(siteLibrary.components)
    .filter(([, definition]) => definition.place === "section")
    .map(([type]) => type);

  it("draws every section but an empty Section with something to see", () => {
    for (const type of sections) {
      const html = sampled(type).innerHTML;
      expect([type, showsAnything(html)]).toEqual([type, type !== "Section"]);
    }
  });

  it("draws each section's items, and what the site gives it as samples, never the site's own", () => {
    // A Gallery's images: the space each takes.
    expect(sampled("Gallery").querySelectorAll(".site-gallery-image")).toHaveLength(6);
    // The FAQ's, Features' and Stats' own sample items.
    expect(sampled("Faq").textContent).toContain("When are you open?");
    // Latest posts: three sample posts, newest first.
    const posts = sampled("LatestPosts").textContent;
    expect(posts).toContain("Our new opening hours");
    expect(posts).toContain("A look behind the scenes");
    // Contact buttons and details: a sample phone number and email address.
    const buttons = sampled("ContactButtons");
    expect(buttons.querySelector('a[href^="tel:"]')).not.toBeNull();
    expect(buttons.querySelector('a[href^="mailto:hello@example.com"]')).not.toBeNull();
    expect(sampled("ContactDetails").textContent).toContain("01632 960123");
    // A sample never goes on the page: the Gallery added is empty.
    expect(siteLibrary.components.Gallery?.defaults.images).toEqual([]);
  });

  it("has no card for a section that shows nothing, so no empty card opens", async () => {
    const { previews, compileCss } = setUp();

    expect(previews({ type: "Section", label: "Section", category: "Layout" })).toBeNull();
    expect(compileCss).not.toHaveBeenCalled();
    // A Gallery's is drawn with its sample images.
    const root = await shown(
      previews({ type: "Gallery", label: "Gallery", category: "Galleries" }),
    );
    expect(root?.querySelectorAll(".site-gallery-image")).toHaveLength(6);
  });

  it("draws a section a third of its size, and at least 120 px tall", async () => {
    const { previews } = setUp();
    const root = await shown(previews({ type: "Hero", label: "Hero", category: "Heroes" }));
    const css = root?.querySelector("style")?.textContent ?? "";
    expect(css).toContain(".wf-preview { width: 960px; min-height: 360px;");
    expect(css).toContain("transform: scale(0.3333333333333333)");
  });
});

/** Lets `ms` pass, and what it set going. */
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("createItemPreviews (3.13a)", () => {
  it("draws the item as it is, at each device's width, in a frame that runs no scripts", async () => {
    const { compileCss } = setUp();
    const previews = createItemPreviews({ library: siteLibrary, theme: () => theme, compileCss });
    const button: NodeDoc = { type: "Button", props: { id: "b", label: "Book now", link: "" } };

    const { container, rerender } = render(previews(button, "mobile"));
    await wait(0);
    const frame = () => container.querySelector("iframe");

    expect(frame()?.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame()?.style.width).toBe("375px");
    const page = frame()?.getAttribute("srcdoc") ?? "";
    expect(page).toContain("Book now");
    // Without its link yet, greyed out as the canvas draws it (#1256).
    expect(page).toContain("btn-disabled");
    expect(page).toContain(".wf-hero{color:red}");
    // Its own font faces: a frame is a document of its own.
    expect(page).toContain("@font-face");
    expect(page).toContain(`data-theme="${theme.preset}"`);

    // Drawn again once the change has settled, as the site CSS is.
    rerender(previews({ ...button, props: { ...button.props, label: "Call us" } }, "mobile"));
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

  it("draws a kind with its look, and again in a theme given anew (#613, CT-11)", async () => {
    const compileCss = vi.fn(async () => ({ status: "compiled" as const, css: "", bodyClass: "" }));
    const previews = createItemPreviews({ library: siteLibrary, theme: () => theme, compileCss });
    const button: NodeDoc = { type: "Button", props: { id: "b", label: "Book now", link: "" } };
    const looked = (lookCorners: string) => ({ ...theme, looks: { Button: { lookCorners } } });

    // As Theme Studio's strip does: the same preview, shown on, while the theme changes.
    const { container, rerender } = render(previews(button, "desktop", looked("full")));
    await wait(0);
    const page = () => container.querySelector("iframe")?.getAttribute("srcdoc") ?? "";
    expect(page()).toContain("rounded-full!");

    rerender(previews(button, "desktop", looked("none")));
    await wait(SITE_CSS_DEBOUNCE_MS + 20);
    expect(page()).toContain("rounded-none!");
    expect(compileCss).toHaveBeenCalledTimes(2);
  });

  it("is never drawn larger than the device, and shown at its place's width (CT-11)", async () => {
    const { compileCss } = setUp();
    const previews = createItemPreviews({ library: siteLibrary, theme: () => theme, compileCss });
    const button: NodeDoc = { type: "Button", props: { id: "b", label: "Book now", link: "" } };
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(640);

    const { container } = render(previews(button, "desktop"));
    await wait(0);
    expect(container.querySelector("iframe")?.style.transform).toBe("scale(0.5)");
    width.mockReturnValue(2560);
    cleanup();
    const again = render(previews(button, "desktop"));
    await wait(0);
    expect(again.container.querySelector("iframe")?.style.transform).toBe("scale(1)");
    width.mockRestore();
  });
});
