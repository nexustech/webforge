import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { defineComponent } from "./define.js";
import { COLORS_FIELD, defineSection, PADDING_FIELD } from "./frame.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";
import type { RenderContext } from "./schema.js";
import {
  BODY_TEXT_CLASSES,
  BUTTON_CLASSES,
  LEAD_TEXT_CLASSES,
  RICH_TEXT_LIST_CLASSES,
  TITLE_CLASSES,
} from "./typography.js";

// The section frame and the typography and button primitives (2.19).

const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  navigation: [
    { label: "Home", href: "index.html", current: true },
    {
      label: "Visit us",
      current: false,
      children: [{ label: "Find us", href: "about.html", current: false }],
    },
    { label: "Book now", href: "about.html", current: false, button: true },
  ],
  image: () => ({
    sources: [],
    src: "assets/img/photo-640.jpg",
    fallback: { type: "image/jpeg", srcset: "assets/img/photo-640.jpg 640w" },
    width: 640,
    height: 480,
    alt: "A photo",
  }),
};

/** Every component of the catalogue in each of its layouts, its fields filled and slots used. */
function everything(): string {
  const nodes: NodeDoc[] = [];
  let next = 0;
  const filled = (type: string, depth = 0): NodeDoc[] => {
    const def = siteLibrary.components[type];
    if (def === undefined) return [];
    const variants = def.fields.variant?.kind === "select" ? def.fields.variant.options : [];
    return (variants.length === 0 ? [undefined] : variants.map((option) => option.value)).map(
      (variant) => {
        const props: NodeDoc["props"] = { id: `n${next++}` };
        if (variant !== undefined) props.variant = variant;
        for (const [name, field] of Object.entries(def.fields)) {
          if (field.kind === "media") props[name] = { mediaId: "photo" };
          if (field.kind === "link") props[name] = "about";
          if (field.kind === "toggle") props[name] = true;
          if (field.kind === "slot" && depth === 0) {
            const types = field.allow ?? ["Heading", "Text"];
            props[name] = types.flatMap((child) => filled(child, depth + 1).slice(0, 1));
          }
        }
        return { type, props };
      },
    );
  };
  for (const type of Object.keys(siteLibrary.components)) nodes.push(...filled(type));
  return renderNodesToHtml(nodes, siteLibrary, context);
}

/** The class attributes of `html`'s tags named by `tag` (any tag if not given). */
function classesOf(html: string, tag = "[a-z0-9]+"): string[] {
  return [...html.matchAll(new RegExp(`<(?:${tag})\\b[^>]*\\bclass="([^"]*)"`, "g"))].map(
    // As written in the code: the HTML escapes `&` in `[&_a]:underline`.
    (match) => (match[1] ?? "").replaceAll("&amp;", "&"),
  );
}

describe("the section frame (2.19)", () => {
  it("frames every section in the catalogue", () => {
    for (const [type, def] of Object.entries(siteLibrary.components)) {
      if (def.place === "section") expect(def.framed, type).toBe(true);
    }
  });

  it("refuses a section defined without its frame", () => {
    expect(() =>
      defineComponent({
        label: "Band",
        place: "section",
        fields: { padding: PADDING_FIELD },
        defaults: {},
        render: () => null,
      }),
    ).toThrow("'Band' is a section: define it with defineSection");
  });

  it("refuses a section that declares its own padding or margin", () => {
    expect(() =>
      defineSection({
        label: "Band",
        name: "band",
        // @ts-expect-error: the frame adds the padding.
        fields: { padding: PADDING_FIELD },
        defaults: {},
        render: () => null,
      }),
    ).toThrow(`'Band' declares its own "padding": defineSection adds it`);
  });

  it("puts a slot's class on an element of its own that holds its elements", () => {
    const strip = defineSection({
      label: "Strip",
      name: "strip",
      fields: { items: { kind: "slot", label: "Items", allow: ["Text"] } },
      defaults: { items: [] },
      render: ({ slots }) => <slots.items className="grid grid-cols-3" />,
    });
    const library = { components: { ...siteLibrary.components, Strip: strip } };
    const text = (id: string): NodeDoc => ({ type: "Text", props: { id, text: "<p>a</p>" } });

    const html = renderNodesToHtml(
      [{ type: "Strip", props: { id: "s", items: [text("t1"), text("t2")] } }],
      library,
      EDITOR_RENDER_CONTEXT,
    );

    // As Puck's drop zone holds them on the canvas, so the grid lays them out alike in both.
    expect(html).toMatch(
      /^<section class="site-strip px-4 py-16"><div class="grid grid-cols-3"><div class="site-text/,
    );
    expect(html.match(/class="site-text/g)).toHaveLength(2);
  });

  it("draws the frame around the inside, with its padding and margin and its attributes", () => {
    const band = defineSection({
      label: "Band",
      name: "band",
      fields: {},
      defaults: {},
      frame: () => "bg-base-200",
      frameAttributes: () => ({ "data-band": "" }),
      render: () => <p>Inside</p>,
    });
    const html = renderNodesToHtml(
      [{ type: "Band", props: { id: "b", margin: { top: "s" } } }],
      { components: { Band: band } },
      EDITOR_RENDER_CONTEXT,
    );

    expect(Object.keys(band.fields)).toEqual([
      "colors",
      "padding",
      "margin",
      "entrance",
      "entranceDelay",
    ]);
    expect(html).toBe(
      '<section class="site-band bg-base-200 px-4 py-16 mt-4" data-band=""><p>Inside</p></section>',
    );
  });

  it("puts a section with reversed colours on the theme's reversed colours (2.4, F-DS-3)", () => {
    const band = (colors?: string): NodeDoc => ({
      type: "Section",
      props: { id: "b", ...(colors === undefined ? {} : { colors }), content: [] },
    });
    const html = (node: NodeDoc) => renderNodesToHtml([node], siteLibrary, EDITOR_RENDER_CONTEXT);

    expect(html(band("inverse"))).toMatch(
      /^<section class="site-section [^"]*" data-theme="wf_inverse">/,
    );
    // The page's colours, as every section had before 2.4: no theme of its own.
    for (const colors of [undefined, "page", "neither"]) {
      expect(html(band(colors))).not.toContain("data-theme");
    }
    // Every section in the catalogue has the option.
    for (const [type, def] of Object.entries(siteLibrary.components)) {
      if (def.place === "section") expect(def.fields.colors, type).toBe(COLORS_FIELD);
    }
  });

  it.each(["id", "type", "props"])(
    "refuses a section whose list items have a field named %s, as defineComponent does (R14)",
    (itemField) => {
      expect(() =>
        defineSection({
          label: "Plans",
          name: "plans",
          fields: {
            plans: {
              kind: "list",
              label: "Plans",
              itemLabel: "Plan",
              fields: { [itemField]: { kind: "text", label: "Kind" } },
              defaults: {},
            },
          },
          defaults: { plans: [] },
          render: () => null,
        }),
      ).toThrow(`'Plans' names a field of "plans"'s items "${itemField}", which items can't have`);
    },
  );

  it("starts every section on the page's colours, as one with no value has", () => {
    for (const [type, def] of Object.entries(siteLibrary.components)) {
      if (def.place === "section") expect(def.defaults.colors, type).toBe("page");
    }
  });

  it("refuses a section that declares its own colours", () => {
    expect(() =>
      defineSection({
        label: "Band",
        name: "band",
        // @ts-expect-error: the frame adds the colours.
        fields: { colors: COLORS_FIELD },
        defaults: {},
        render: () => null,
      }),
    ).toThrow(`'Band' declares its own "colors": defineSection adds it`);
  });
});

describe("the typography and button primitives (2.19)", () => {
  const html = everything();
  const titles = new Set<string>(Object.values(TITLE_CLASSES));
  const buttons = Object.values(BUTTON_CLASSES);

  it("titles every heading with the catalogue's title classes", () => {
    const headings = classesOf(html, "h1|h2|h3|h4|h5|h6");
    expect(headings.length).toBeGreaterThan(5);
    for (const classes of headings) expect(titles, classes).toContain(classes);
  });

  it("sets running text with the body-text classes only, and a lead with the lead classes", () => {
    const body = classesOf(html).filter((classes) => classes.split(" ").includes("text-body"));
    expect(body.length).toBeGreaterThan(2);
    const leads = body.filter((classes) => !classes.includes(BODY_TEXT_CLASSES));
    // A Hero's, a Call to action's and a carousel's lead (#419's follow-up in 2.13a).
    expect(leads.length).toBeGreaterThan(0);
    for (const classes of leads) expect(classes.split(" "), classes).toContain(LEAD_TEXT_CLASSES);
  });

  it("marks the lists in rich text, never the element the classes are on (#388)", () => {
    // Only lists inside: the List element's own <ul> carries the body-text classes too, and keeps
    // its own markers (bullets, numbers or none).
    const rules = RICH_TEXT_LIST_CLASSES.split(" ");
    expect(rules).toEqual(expect.arrayContaining(["[&_ul]:list-disc", "[&_ol]:list-decimal"]));
    for (const rule of rules) expect(rule, rule).toMatch(/^\[&_(ul|ol)\]:/);
    expect(BODY_TEXT_CLASSES).toContain(RICH_TEXT_LIST_CLASSES);

    const text = renderNodesToHtml(
      [{ type: "Text", props: { id: "list", text: "<ul><li>Bread</li><li>Cakes</li></ul>" } }],
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    );
    expect(text).toContain("[&amp;_ul]:list-disc");
    expect(text).toContain("<ul><li>Bread</li><li>Cakes</li></ul>");
  });

  it("draws every button with the button classes, placing classes after them", () => {
    const drawn = classesOf(html).filter((classes) => classes.split(" ").includes("btn"));
    expect(drawn.length).toBeGreaterThan(5);
    for (const classes of drawn) {
      expect(
        buttons.some((button) => classes === button || classes.startsWith(`${button} `)),
        classes,
      ).toBe(true);
    }
  });
});
