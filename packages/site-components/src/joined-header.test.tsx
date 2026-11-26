import { INVERSE_THEME, type NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { joinedHeaderOf, onDarkGround } from "./joined-header.js";
import { type ComponentLibrary, EDITOR_RENDER_CONTEXT, fieldsHiddenBy } from "./library.js";
import { renderNodesToHtml, renderPage } from "./render-static.js";
import type { ResolvedImage } from "./schema.js";

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
      grounds: ["base-100"],
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

  it("sits on a picture a section draws behind its content, whatever colour is over it (HH-3)", () => {
    // A Hero whose overlay is the page's colour: its frame fills with the page's colour.
    const library: ComponentLibrary = {
      components: {
        ...siteLibrary.components,
        Photo: {
          label: "Photo",
          fields: {},
          defaults: { variant: "background" },
          pictureBehind: [{ field: "image", variants: ["background"] }],
          sectionGround: () => "base-100",
          render: () => null,
        },
      },
    };
    const photo: NodeDoc = { type: "Photo", props: { id: "photo", image: { mediaId: "photo" } } };
    expect(joinedHeaderOf({ header: [header()], content: [photo] }, library)?.section).toBe(
      "photo",
    );
    // Without its picture, it's on the page's colour, and the Header keeps its band.
    const bare: NodeDoc = { type: "Photo", props: { id: "photo" } };
    expect(joinedHeaderOf({ header: [header()], content: [bare] }, library)).toBeUndefined();
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

describe("the colours a joined Header sits on (HH-2)", () => {
  it("is the overlay's colour over a picture, whatever is under it", () => {
    expect(joined([header()], [hero()])?.grounds).toEqual(["neutral"]);
    expect(joined([header()], [hero({ overlayColor: "base" })])?.grounds).toEqual(["base-100"]);
    expect(
      joined([header()], [text("story", { backgroundImage: { mediaId: "photo" } })])?.grounds,
    ).toEqual(["base-100"]);
    // The picture covers the person's background.
    expect(joined([header()], [hero({ lookBackground: "primary" })])?.grounds).toEqual(["neutral"]);
  });

  it("is the section's own colour, else the page's, without a picture", () => {
    // A Hero with its picture beside the text, on the theme's second surface.
    expect(joined([header()], [hero({ variant: "split" })])?.grounds).toEqual(["base-200"]);
    expect(joined([header()], [text("story")])?.grounds).toEqual(["base-100"]);
  });

  it("is the person's background on each device, or a gradient's two colours", () => {
    expect(
      joined([header()], [text("story", { colors: "page", lookBackground: "neutral" })])?.grounds,
    ).toEqual(["neutral"]);
    expect(
      joined(
        [header()],
        [
          text("story", {
            colors: "page",
            lookBackground: { $responsive: { mobile: "theme", desktop: "primary" } },
          }),
        ],
      )?.grounds,
    ).toEqual(["base-100", "primary"]);
    expect(
      joined(
        [header()],
        [
          text("story", {
            colors: "page",
            lookGradientDirection: "toBottom",
            lookGradientFrom: "neutral",
            lookGradientTo: "secondary-800/80",
          }),
        ],
      )?.grounds,
    ).toEqual(["neutral", "secondary-800/80"]);
  });
});

describe("onDarkGround (HH-2)", () => {
  const dark = { colors: ["neutral", "primary-800"], inverse: ["base-100"] };

  it("is dark only where every colour is one of the theme's dark ones", () => {
    expect(onDarkGround(["neutral"], false, dark)).toBe(true);
    expect(onDarkGround(["neutral", "base-100"], false, dark)).toBe(false);
    // At an opacity, as the colour.
    expect(onDarkGround(["primary-800/80"], false, dark)).toBe(true);
  });

  it("reads reversed sections' colours in the reversed list", () => {
    expect(onDarkGround(["base-100"], true, dark)).toBe(true);
    expect(onDarkGround(["base-100"], false, dark)).toBe(false);
  });

  it("is never dark without the theme's dark colours, or without a colour", () => {
    expect(onDarkGround(["neutral"], false, undefined)).toBe(false);
    expect(onDarkGround([], false, dark)).toBe(false);
  });
});

describe("the Header's logo for dark backgrounds (HH-2)", () => {
  /** A picture by its id, as the export resolves one: `gone` is no longer in Media. */
  const image = (id: string): ResolvedImage | null =>
    id === "gone"
      ? null
      : {
          sources: [{ type: "image/webp", srcset: `${id}.webp 320w` }],
          src: `${id}.png`,
          fallback: { type: "image/png", srcset: `${id}.png 320w` },
          width: 320,
          height: 120,
          alt: "",
        };
  /** The theme's dark colours: the light theme's, where the page's surface is light. */
  const lightTheme = { colors: ["neutral"], inverse: ["base-100"] };
  const darkTheme = { colors: ["neutral", "base-100"], inverse: [] };

  /** The Header's logos' `src`s, and the classes of each `<picture>`, on a page of `content`. */
  function logos(
    headerProps: Record<string, unknown>,
    content: readonly NodeDoc[],
    context: Record<string, unknown> = {},
  ) {
    const page = renderPage({ header: [header(headerProps)], content, footer: [] }, siteLibrary, {
      ...EDITOR_RENDER_CONTEXT,
      image,
      logo: "logo",
      logoOnDark: "light",
      darkGrounds: lightTheme,
      ...context,
    });
    const happy = new Window();
    windows.push(happy);
    happy.document.body.innerHTML = page.header;
    return [...happy.document.querySelectorAll("header picture")].map((picture) => ({
      src: picture.querySelector("img")?.getAttribute("src"),
      alt: picture.querySelector("img")?.getAttribute("alt"),
      webp: picture.querySelector("source")?.getAttribute("srcset"),
      classes: picture.getAttribute("class"),
    }));
  }

  it("shows the logo on a light colour, and the logo for dark backgrounds on a dark one", () => {
    expect(logos({}, [hero()]).map(({ src }) => src)).toEqual(["light.png"]);
    expect(logos({}, [hero({ overlayColor: "base" })]).map(({ src }) => src)).toEqual(["logo.png"]);
    // Its own band, on the page's surface.
    expect(logos({ background: "own" }, [hero()]).map(({ src }) => src)).toEqual(["logo.png"]);
    expect(
      logos({ background: "own" }, [hero()], { darkGrounds: darkTheme }).map(({ src }) => src),
    ).toEqual(["light.png"]);
  });

  it("draws as before without one, or without the theme's dark colours", () => {
    const without = logos({}, [hero()], { logoOnDark: undefined });
    expect(without).toEqual([
      { src: "logo.png", alt: "Rosa's Bakery", webp: "logo.webp 320w", classes: null },
    ]);
    expect(logos({}, [hero()], { darkGrounds: undefined }).map(({ src }) => src)).toEqual([
      "logo.png",
    ]);
  });

  it("shows the logo where the one for dark backgrounds is gone from Media, and none without a logo", () => {
    expect(logos({}, [hero()], { logoOnDark: "gone" }).map(({ src }) => src)).toEqual(["logo.png"]);
    expect(logos({}, [hero()], { logo: undefined })).toEqual([]);
  });

  it("swaps them as a Header that stays at the top changes colours, both named and in WebP", () => {
    const swapped = logos({ sticky: true, scrollStyle: "shrink" }, [hero()]);
    expect(swapped).toEqual([
      {
        src: "light.png",
        alt: "Rosa's Bakery",
        webp: "light.webp 320w",
        classes: "in-data-scrolled:hidden",
      },
      {
        src: "logo.png",
        alt: "Rosa's Bakery",
        webp: "logo.webp 320w",
        classes: "hidden in-data-scrolled:block",
      },
    ]);
    // On a dark theme it's on a dark colour either way: one picture.
    expect(
      logos({ sticky: true }, [hero()], { darkGrounds: darkTheme }).map(({ classes }) => classes),
    ).toEqual([null]);
  });

  it("reads a reversed section in its reversed colours", () => {
    expect(logos({}, [text("story")]).map(({ src }) => src)).toEqual(["light.png"]);
    expect(logos({}, [text("story")], { darkGrounds: darkTheme }).map(({ src }) => src)).toEqual([
      "logo.png",
    ]);
  });
});
