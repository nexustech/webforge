import { INVERSE_THEME, type NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { joinedHeaderOf } from "./joined-header.js";
import { EDITOR_RENDER_CONTEXT, fieldsHiddenBy } from "./library.js";
import { renderNodesToHtml, renderPage } from "./render-static.js";

// A Header joined to its page's first section (HH-1): what it takes from the section, how both are
// drawn, and the scroll styles it offers.

const header = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Header",
  props: { id: "header", siteName: "Rosa's Bakery", background: "section", ...props },
});

const hero = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Hero",
  props: {
    id: "hero",
    title: "Baked fresh every morning",
    image: { mediaId: "photo" },
    variant: "background",
    ...props,
  },
});

/** A Text section, in reversed colours unless `props` say otherwise. */
const text = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "TextSection",
  props: { id, title: "Our story", text: "<p>Since 1998.</p>", colors: "inverse", ...props },
});

const joined = (headerNodes: readonly NodeDoc[], content: readonly NodeDoc[]) =>
  joinedHeaderOf({ header: headerNodes, content }, siteLibrary);

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page's Header and main as the export renders them, in one document to query. */
function rendered(headerNodes: readonly NodeDoc[], content: readonly NodeDoc[]) {
  const page = renderPage({ header: headerNodes, content, footer: [] }, siteLibrary, {
    ...EDITOR_RENDER_CONTEXT,
    image: () => ({
      sources: [],
      src: "photo.jpg",
      fallback: { type: "image/jpeg", srcset: "photo.jpg 800w" },
      width: 800,
      height: 600,
      alt: "",
    }),
  });
  const happy = new Window();
  windows.push(happy);
  const { document } = happy;
  document.body.innerHTML = `${page.header}<main>${page.main}</main>`;
  return document;
}

describe("joinedHeaderOf (HH-1)", () => {
  it("is nothing for a Header with its own background, as every Header saved before has", () => {
    expect(joined([header({ background: undefined })], [hero()])).toBeUndefined();
    expect(joined([header({ background: "own" })], [hero()])).toBeUndefined();
  });

  it("is nothing on a page with no sections, or whose Header is hidden or not shown", () => {
    expect(joined([header()], [])).toBeUndefined();
    expect(joined([header({ hidden: true })], [hero()])).toBeUndefined();
    expect(joined([], [hero()])).toBeUndefined();
  });

  it("follows the first section shown, and its id", () => {
    expect(joined([header()], [hero(), text("story")])?.section).toBe("hero");
    expect(joined([header()], [hero({ hidden: true }), text("story")])?.section).toBe("story");
    // Moved to the top, another section leads.
    expect(joined([header()], [text("story"), hero()])?.section).toBe("story");
  });

  it("follows a Blog design's section the canvas draws between the Header and a post (6.10a)", () => {
    expect(joined([header(), text("design")], [hero()])?.section).toBe("design");
  });

  it("takes a reversed section's colours (2.4)", () => {
    expect(joined([header()], [text("story", { colors: "inverse" })])).toEqual({
      section: "story",
      inverse: true,
      text: "",
    });
  });

  it("takes the colour the Hero sets its text in over its picture, and none beside it", () => {
    const over = joined([header()], [hero()]);
    expect(over?.text).toBe("text-neutral-content");
    // The same class the Hero draws its own text with: a change to one is a change to both.
    const drawn = rendered([header()], [hero()]).querySelector(".hero-content");
    expect(drawn?.classList.contains("text-neutral-content")).toBe(true);

    expect(joined([header()], [hero({ variant: "split" })])?.text).toBe("");
  });

  it("keeps the Header's band on a section in the page's own colours, as it looks the same", () => {
    expect(joined([header()], [text("story", { colors: "page" })])).toBeUndefined();
    // Anything of its own under the Header joins it: a colour, a gradient, a picture.
    expect(
      joined([header()], [text("story", { colors: "page", lookBackground: "base-200" })])?.section,
    ).toBe("story");
    expect(
      joined([header()], [text("story", { colors: "page", lookGradientDirection: "toBottom" })])
        ?.section,
    ).toBe("story");
  });

  it("takes a section's background picture's overlay colour, and the person's Colour per device", () => {
    expect(
      joined(
        [header()],
        [
          text("story", {
            colors: "page",
            backgroundImage: { mediaId: "photo" },
            overlayColor: "neutral",
          }),
        ],
      )?.text,
    ).toBe("text-neutral-content");
    expect(
      joined(
        [header()],
        [text("story", { lookColor: { $responsive: { desktop: "primary", mobile: "accent" } } })],
      )?.text,
    ).toBe("max-md:text-accent! md:text-primary!");
  });
});

describe("a Header joined to its first section, drawn (HH-1)", () => {
  it("has no band of its own and sits on the section, which makes room for it", () => {
    const page = rendered([header()], [hero()]);
    const drawn = page.querySelector("header");
    expect(drawn?.hasAttribute("data-wf-joined")).toBe(true);
    expect(drawn?.className).toContain("bg-transparent");
    expect(drawn?.className).toContain("-mb-(--wf-header-h)");
    expect(drawn?.className).not.toContain("bg-base-100");
    expect(drawn?.className).not.toContain("shadow-sm");
    expect(drawn?.className).toContain("text-neutral-content");
    const section = page.querySelector("main section");
    expect(section?.className).toContain("pt-[calc(var(--wf-header-h)+var(--spacing)*16)]");
    expect(section?.className).toContain("pb-16");
  });

  it("shrinks its bar at a capped width, solid once scrolled, as a Header with its own does", () => {
    const drawn = rendered(
      [header({ sticky: true, scrollStyle: "shrink", contentWidth: "wide" })],
      [hero()],
    );
    expect(drawn.querySelector("header")?.className).toContain(
      "group sticky top-0 transition-colors data-scrolled:bg-base-100",
    );
    expect(drawn.querySelector(".site-header-bar")?.className).toContain(
      "group-data-scrolled:min-h-12",
    );
  });

  it("gives a section whose column holds its padding the Header's height above it", () => {
    const buttons: NodeDoc = {
      type: "ContactButtons",
      props: { id: "buttons", colors: "inverse" },
    };
    const section = rendered([header()], [buttons]).querySelector("main > *");
    expect(section?.className).toContain("pt-(--wf-header-h)");
  });

  it("takes a reversed section's colours as its own theme", () => {
    const drawn = rendered([header()], [text("story", { colors: "inverse" })]).querySelector(
      "header",
    );
    expect(drawn?.getAttribute("data-theme")).toBe(INVERSE_THEME);
  });

  it("draws a Header saved with Solid background or None as Shadow while joined, and keeps them for its own", () => {
    for (const scrollStyle of ["solid", "none"]) {
      const drawn = rendered([header({ sticky: true, scrollStyle })], [hero()]).querySelector(
        "header",
      );
      expect(drawn?.className).toContain("data-scrolled:shadow-md");
      expect(drawn?.className).toContain("data-scrolled:bg-base-100");
      expect(drawn?.className).not.toContain("backdrop-blur");
    }
    const own = rendered(
      [header({ background: "own", sticky: true, scrollStyle: "solid" })],
      [hero()],
    ).querySelector("header");
    expect(own?.className).toContain("backdrop-blur");
  });

  it("hides on the way down while joined, solid as it comes back (HH-7)", () => {
    const def = siteLibrary.components.Header;
    const drawn = rendered([header({ sticky: true, scrollStyle: "hide" })], [hero()]).querySelector(
      "header",
    );
    expect(drawn?.getAttribute("data-wf-sticky")).toBe("hide");
    expect(drawn?.className).toContain("data-hidden:-translate-y-full");
    expect(drawn?.className).toContain("data-scrolled:bg-base-100");
    const behaviours = def?.behaviours;
    if (typeof behaviours !== "function")
      throw new Error("The Header's behaviours follow its values");
    expect(
      behaviours({ ...def?.defaults, background: "section", sticky: true, scrollStyle: "hide" }),
    ).toEqual(["menu", "sticky", "header-hide", "joined"]);
  });

  it("keeps the phone menu's panel solid, in the page's text colour", () => {
    const panel = rendered([header()], [hero()]).querySelector("details[data-wf-menu] > ul");
    expect(panel?.className).toContain("bg-base-100");
    expect(panel?.className).toContain("text-base-content");
  });

  it("is drawn as before on a page with no sections, and with its own background", () => {
    const empty = rendered([header()], []).querySelector("header");
    expect(empty?.hasAttribute("data-wf-joined")).toBe(false);
    expect(empty?.className).toContain("bg-base-100 shadow-sm");
    const own = renderNodesToHtml(
      [header({ background: undefined })],
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    );
    expect(
      renderNodesToHtml([header({ background: "own" })], siteLibrary, EDITOR_RENDER_CONTEXT),
    ).toBe(own);
  });

  it("gives the page's other sections and its Footer nothing of it", () => {
    const page = rendered([header()], [hero(), text("story")]);
    expect(page.querySelector(".site-text-section")?.className).not.toContain("--wf-header-h");
  });

  it("adds the joined script to the page only for a joined Header", () => {
    const def = siteLibrary.components.Header;
    const behaviours = def?.behaviours;
    if (typeof behaviours !== "function")
      throw new Error("The Header's behaviours follow its values");
    expect(behaviours({ ...def?.defaults, background: "section" })).toContain("joined");
    expect(behaviours({ ...def?.defaults })).not.toContain("joined");
  });
});

describe("the joined Header's scroll styles (HH-1)", () => {
  const scrollStyle = siteLibrary.components.Header?.fields.scrollStyle;

  it("offers Shadow, Shrink and Hide when scrolling down while joined, and every style with its own", () => {
    expect(
      scrollStyle?.kind === "select" && scrollStyle.offered?.({ background: "section" }),
    ).toEqual(["shadow", "shrink", "hide"]);
    expect(scrollStyle?.kind === "select" && scrollStyle.offered?.({ background: "own" })).toBe(
      undefined,
    );
  });

  it("is a field of the Header, shown with its other settings", () => {
    const def = siteLibrary.components.Header;
    if (def === undefined) throw new Error("No Header");
    expect(def.fields.background).toBeDefined();
    expect(fieldsHiddenBy(def, { ...def.defaults, background: "section" }).has("background")).toBe(
      false,
    );
  });
});
