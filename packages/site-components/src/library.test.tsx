import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import {
  BOX_CLASS_SAFELIST,
  boxClasses,
  boxTokenPixels,
  colorClass,
  EDITOR_RENDER_CONTEXT,
  optionValue,
  responsiveClasses,
  slotComponent,
  stringValue,
  textStylesOf,
  textValue,
  withAdvanced,
} from "./library.js";

describe("library helpers", () => {
  it("textValue passes renderable text and drops anything else", () => {
    expect(textValue("Hi")).toBe("Hi");
    expect(textValue(3)).toBe(3);
    expect(renderToStaticMarkup(textValue(<b>bold</b>))).toBe("<b>bold</b>");
    expect(textValue({ html: "x" })).toBeNull();
    expect(textValue(undefined)).toBeNull();
  });

  it("stringValue keeps strings only", () => {
    expect(stringValue("about")).toBe("about");
    expect(stringValue(1)).toBe("");
    expect(stringValue(undefined)).toBe("");
  });

  it("optionValue falls back to the first option", () => {
    expect(optionValue("b", ["a", "b"])).toBe("b");
    expect(optionValue("c", ["a", "b"])).toBe("a");
    expect(optionValue(1, ["a"])).toBe("a");
  });

  it("slotComponent returns the slot or an empty one", () => {
    const Slot = () => <i>slot</i>;
    const props = { id: "x", values: {}, slots: { content: Slot }, context: EDITOR_RENDER_CONTEXT };
    const Missing = slotComponent(props, "other");

    expect(slotComponent(props, "content")).toBe(Slot);
    expect(renderToStaticMarkup(<Missing />)).toBe("");
  });

  it("the editor context has no navigation, dead links and no images", () => {
    expect(EDITOR_RENDER_CONTEXT.navigation).toEqual([]);
    expect(EDITOR_RENDER_CONTEXT.link("about")).toBe("#");
    expect(EDITOR_RENDER_CONTEXT.image("hero")).toBeNull();
  });

  it("responsiveClasses gives a plain value's classes alone", () => {
    expect(responsiveClasses<string>("small", (value) => `py-${value}`)).toBe("py-small");
  });

  it("responsiveClasses builds mobile-first classes, prefixed only where a device differs", () => {
    // Mobile falls back to Tablet, then Desktop.
    const classes = (value: string | undefined) => (value === "large" ? "py-24" : "py-8");

    expect(
      responsiveClasses<string>({ $responsive: { desktop: "large", mobile: "small" } }, classes),
    ).toBe("py-8 md:py-24");
    expect(
      responsiveClasses<string>({ $responsive: { desktop: "small", tablet: "large" } }, classes),
    ).toBe("py-24 lg:py-8");
  });

  const SECTION = { top: 16, right: 4, bottom: 16, left: 4 };

  it("boxClasses gives the default sides, left and right first, in pairs where equal", () => {
    expect(boxClasses(undefined, "padding", SECTION)).toBe("px-4 py-16");
    expect(boxClasses({ top: "s" }, "padding", SECTION)).toBe("px-4 pt-8 pb-16");
    expect(boxClasses({ left: "none", right: "xl", bottom: "l" }, "padding", SECTION)).toBe(
      "pl-0 pr-32 pt-16 pb-24",
    );
    expect(boxClasses({ top: "xl", right: "xl", bottom: "xl", left: "xl" }, "padding")).toBe(
      "px-32 py-32",
    );
  });

  it("boxClasses gives a value that is no box the defaults (format 6 migrates old sizes)", () => {
    expect(boxClasses("large", "padding", SECTION)).toBe("px-4 py-16");
  });

  it("boxClasses gives a margin its own scale, and no class for sides never set", () => {
    expect(boxClasses(undefined, "margin")).toBe("");
    expect(boxClasses({}, "margin")).toBe("");
    expect(boxClasses({ top: "s", bottom: "xl" }, "margin")).toBe("mt-4 mb-24");
    expect(boxClasses({ top: "m", bottom: "m" }, "margin")).toBe("my-8");
    // Not `mb-0`, which would take away the section's space between elements below it.
    expect(boxClasses({ top: "s" }, "margin")).toBe("mt-4");
  });

  it("boxClasses reads only the sides asked for", () => {
    expect(boxClasses({ left: "l", top: "l" }, "margin", {}, ["top", "bottom"])).toBe("mt-16");
    expect(boxClasses({ left: "l" }, "margin", {}, ["top", "bottom"])).toBe("");
  });

  it("boxClasses sets a side per device, for that device only where another leaves it unset", () => {
    // Mobile falls back to Tablet, then Desktop, as a whole box.
    expect(
      boxClasses({ $responsive: { desktop: { top: "l" }, mobile: { top: "s" } } }, "margin", {}, [
        "top",
        "bottom",
      ]),
    ).toBe("max-md:mt-4 md:mt-16");
    expect(boxClasses({ $responsive: { desktop: {}, mobile: { bottom: "m" } } }, "margin")).toBe(
      "max-md:mb-8",
    );
    expect(
      boxClasses({ $responsive: { desktop: { top: "s" }, tablet: { top: "m" } } }, "margin"),
    ).toBe("max-lg:mt-8 lg:mt-4");
    expect(
      boxClasses(
        { $responsive: { desktop: { top: "s" }, tablet: { top: "m" }, mobile: { top: "s" } } },
        "margin",
      ),
    ).toBe("max-md:mt-4 md:max-lg:mt-8 lg:mt-4");
    // Every device sets both sides: mobile first.
    expect(
      boxClasses(
        { $responsive: { desktop: { top: "s", bottom: "s" }, mobile: { top: "m", bottom: "s" } } },
        "margin",
      ),
    ).toBe("mt-8 mb-4 md:my-4");
    expect(
      boxClasses({ $responsive: { desktop: { left: "s" }, tablet: {} } }, "padding", SECTION),
    ).toBe("px-4 lg:pl-8 lg:pr-4 py-16");
  });
});

describe("spacing for the canvas's handles (1.32)", () => {
  it("boxTokenPixels gives each token's size in CSS pixels", () => {
    expect(boxTokenPixels("padding")).toEqual({ none: 0, s: 32, m: 64, l: 96, xl: 128 });
    expect(boxTokenPixels("margin")).toEqual({ none: 0, s: 16, m: 32, l: 64, xl: 96 });
  });

  it("BOX_CLASS_SAFELIST has every class boxClasses gives, on every device", () => {
    const given = [
      boxClasses(undefined, "padding", { top: 16, right: 4, bottom: 16, left: 4 }),
      boxClasses({ left: "xl", right: "none", top: "s" }, "padding", { right: 4, bottom: 16 }),
      boxClasses({ $responsive: { desktop: { top: "xl" }, tablet: { top: "m" } } }, "margin"),
      boxClasses(
        { $responsive: { desktop: { top: "s" }, tablet: { top: "l" }, mobile: { top: "s" } } },
        "margin",
      ),
      boxClasses({ $responsive: { desktop: { top: "s", bottom: "s" }, mobile: {} } }, "margin"),
    ].flatMap((classes) => classes.split(" "));

    expect(given.filter((name) => !BOX_CLASS_SAFELIST.includes(name))).toEqual([]);
    expect(new Set(BOX_CLASS_SAFELIST).size).toBe(BOX_CLASS_SAFELIST.length);
  });
});

describe("withAdvanced", () => {
  const html = (advanced: unknown) =>
    renderToStaticMarkup(<>{withAdvanced(<h2 className="site-heading">Hi</h2>, advanced)}</>);

  it("adds the classes after the component's own, the attributes and the anchor as id", () => {
    expect(
      html({
        className: "shadow-lg",
        anchorId: "opening-times",
        attributes: { "data-track": "hero", tabindex: "0", role: "note" },
      }),
    ).toBe(
      '<h2 class="site-heading shadow-lg" data-track="hero" tabindex="0" role="note" id="opening-times">Hi</h2>',
    );
  });

  it("leaves the output alone without options, with invalid ones, or without an element root", () => {
    expect(html(undefined)).toBe('<h2 class="site-heading">Hi</h2>');
    // Checked again here: an event handler never reaches a page, whatever the document holds.
    expect(html({ attributes: { onclick: "alert(1)" } })).toBe('<h2 class="site-heading">Hi</h2>');
    expect(html({ anchorId: "Not valid" })).toBe('<h2 class="site-heading">Hi</h2>');
    expect(renderToStaticMarkup(<>{withAdvanced("text", { className: "x" })}</>)).toBe("text");
  });
});

describe("textStylesOf (1.37)", () => {
  it("is a Heading's level by its size, a Text's body, and nothing for a component without text", () => {
    expect(
      textStylesOf({ type: "Heading", props: { id: "h", size: "large" } }, siteLibrary),
    ).toEqual(["h1"]);
    // Its default size, medium, when it has none.
    expect(textStylesOf({ type: "Heading", props: { id: "h" } }, siteLibrary)).toEqual(["h2"]);
    expect(textStylesOf({ type: "Text", props: { id: "t" } }, siteLibrary)).toEqual(["body"]);
    expect(textStylesOf({ type: "Section", props: { id: "s" } }, siteLibrary)).toEqual([]);
    expect(textStylesOf({ type: "Nothing", props: { id: "n" } }, siteLibrary)).toEqual([]);
  });

  it("gives each device's style when a value differs by device", () => {
    const library = {
      components: {
        Title: {
          label: "Title",
          fields: {},
          defaults: {},
          render: () => null,
          textStyle: (values: Readonly<Record<string, unknown>>) =>
            values.big === true ? ("h1" as const) : ("h4" as const),
        },
      },
    };
    const node = {
      type: "Title",
      props: { id: "t", big: { $responsive: { desktop: true, mobile: false } } },
    };

    expect(textStylesOf(node, library)).toEqual(["h1", "h4"]);
  });

  it("reads a value the element doesn't set from its kind's look (3.12)", () => {
    const library = {
      components: {
        Title: {
          label: "Title",
          fields: {},
          defaults: { lookSize: "default" },
          render: () => null,
          textStyle: (values: Readonly<Record<string, unknown>>) =>
            values.lookSize === "h1" ? ("h1" as const) : ("body" as const),
        },
      },
    };
    const looks = { Title: { lookSize: "h1" } };

    expect(textStylesOf({ type: "Title", props: { id: "t" } }, library, looks)).toEqual(["h1"]);
    // Its own value wins.
    expect(
      textStylesOf({ type: "Title", props: { id: "t", lookSize: "body" } }, library, looks),
    ).toEqual(["body"]);
  });
});

describe("colorClass (1.37, ADR 0009)", () => {
  it("gives a colour ref's class, and none for the element's own colour or anything else", () => {
    expect(colorClass("text", "primary")).toBe("text-primary");
    expect(colorClass("text", "primary-300/80")).toBe("text-primary-300/80");
    expect(colorClass("bg", "[#1F6FEB]/50")).toBe("bg-[#1f6feb]/50");
    expect(colorClass("text", "default")).toBe("");
    // Nothing that isn't a colour ref reaches a class.
    expect(colorClass("text", "red-500 hidden")).toBe("");
    expect(colorClass("text", "[#1f6feb] x")).toBe("");
    expect(colorClass("text", 42)).toBe("");
  });

  it("colours a Heading with the ref its field stores", () => {
    const heading = siteLibrary.components.Heading;
    if (heading === undefined) throw new Error("no Heading");
    const html = (color: string) =>
      renderToStaticMarkup(
        <>
          {heading.render({
            values: { ...heading.defaults, text: "Hi", color },
            slots: {},
            context: EDITOR_RENDER_CONTEXT,
            id: "h",
          })}
        </>,
      );

    expect(html("primary-300/80")).toContain("text-primary-300/80");
    expect(html("[#1f6feb]")).toContain("text-[#1f6feb]");
    expect(html("default")).not.toContain("text-primary");
  });
});
