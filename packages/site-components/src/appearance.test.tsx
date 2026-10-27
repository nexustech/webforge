import type { NodeDoc } from "@webforge/model";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  APPEARANCE_FIELDS,
  APPEARANCE_FIELDS_WITHOUT_TEXT,
  appearanceBoxClasses,
  appearanceTextClasses,
  whereOwnColour,
} from "./appearance.js";
import { siteLibrary } from "./catalogue/index.js";
import { defineComponent, LOOK_TARGET } from "./define.js";
import { EDITOR_RENDER_CONTEXT, fieldsHiddenBy } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";

const render = (nodes: NodeDoc[]) => renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);

/** Every section and element of the library, by type. */
const placed = (place: "section" | "element") =>
  Object.entries(siteLibrary.components)
    .filter(([, def]) => (def.place ?? "element") === place)
    .map(([type]) => type);

describe("the Appearance group (2.22, ST-1)", () => {
  it("is on every section and element, first in the Style tab, and on no child", () => {
    for (const [type, def] of Object.entries(siteLibrary.components)) {
      const names = Object.keys(def.fields);
      // The Header and Footer are the page's layout, not sections placed on it.
      if (def.place === "layout") continue;
      if (def.place === "child") {
        expect(
          names.some((name) => name.startsWith("look")),
          type,
        ).toBe(false);
        continue;
      }
      // A section without a title of its own has no Text controls (2.22b).
      const group = Object.keys(
        def.place === "section" && !Object.hasOwn(def.fields, "lookSize")
          ? APPEARANCE_FIELDS_WITHOUT_TEXT
          : APPEARANCE_FIELDS,
      );
      expect(names.slice(0, group.length), type).toEqual(group);
    }
  });

  it("is tokens only, set per device, in its own group of the Style tab (ST-6, F-ED-4)", () => {
    for (const [name, field] of Object.entries(APPEARANCE_FIELDS)) {
      expect(["select", "toggle", "color"], name).toContain(field.kind);
      expect(field.group, name).toBe("style");
      expect(field.responsive, name).toBe(true);
      expect(field.optionGroup, name).toEqual({ id: "appearance", label: "Appearance" });
    }
  });

  it("draws nothing for the theme's look, and each choice as theme classes that win", () => {
    expect(appearanceTextClasses({})).toBe("");
    expect(appearanceBoxClasses({ lookColor: "default", lookShadow: "default" })).toBe("");
    // The colour field's *Theme's* choice draws no class either.
    expect(appearanceBoxClasses({ lookColor: "theme", lookBackground: "theme" })).toBe("");
    expect(
      appearanceTextClasses({
        lookSize: "h2",
        lookWeight: "bold",
        lookItalic: true,
        lookUnderline: true,
        lookCase: "uppercase",
        lookAlign: "centre",
      }),
    ).toBe("text-h2! font-bold! italic! underline! uppercase! text-center!");
    expect(
      appearanceBoxClasses({
        lookColor: "primary-700",
        lookBackground: "base-200",
        lookCorners: "large",
        lookBorder: "thin",
        lookBorderColor: "accent",
        lookShadow: "medium",
        lookOpacity: "75",
      }),
    ).toBe(
      "text-primary-700! bg-base-200! rounded-box! border! border-solid! border-accent! shadow-md! opacity-75!",
    );
    // Nothing but a token reaches a class.
    expect(appearanceBoxClasses({ lookColor: "red hidden", lookCorners: "huge" })).toBe("");
  });

  it("sets a value per device, mobile first", () => {
    expect(
      appearanceTextClasses({
        lookUnderline: { $responsive: { desktop: true, tablet: false, mobile: false } },
      }),
    ).toBe("lg:underline!");
    expect(
      appearanceTextClasses({ lookSize: { $responsive: { desktop: "h1", mobile: "h3" } } }),
    ).toBe("max-md:text-h3! md:text-h1!");
  });

  it("draws a device's choice across its own widths only: Theme's on another draws nothing there", () => {
    // Mobile set, Tablet and Desktop at the theme's look.
    expect(
      appearanceTextClasses({
        lookSize: { $responsive: { desktop: "default", tablet: "default", mobile: "small" } },
        lookUnderline: { $responsive: { desktop: false, tablet: false, mobile: true } },
      }),
    ).toBe("max-md:text-small! max-md:underline!");
    // And the reverse: Desktop set, the others at the theme's look.
    expect(
      appearanceBoxClasses({
        lookShadow: { $responsive: { desktop: "large", tablet: "default", mobile: "default" } },
      }),
    ).toBe("lg:shadow-lg!");
    // Tablet alone, and one value on every device.
    expect(
      appearanceBoxClasses({
        lookOpacity: { $responsive: { desktop: "default", tablet: "50", mobile: "default" } },
        lookCorners: { $responsive: { desktop: "full", tablet: "full", mobile: "full" } },
      }),
    ).toBe("rounded-full! md:max-lg:opacity-50!");
  });

  it("underlines a section's title, and no other title in it (the product owner's example)", () => {
    const html = render([
      {
        type: "Hero",
        props: { id: "hero", title: "Fresh bread", lookUnderline: true, lookShadow: "large" },
      },
      {
        type: "Section",
        props: {
          id: "band",
          lookUnderline: true,
          content: [{ type: "Features", props: { id: "inner" } }],
        },
      },
    ]);
    expect(html).toMatch(/<h1 class="font-heading text-h1 underline!">Fresh bread<\/h1>/);
    // The section's own frame takes the rest of the group.
    expect(html).toMatch(/<section class="site-hero [^"]* shadow-lg!"/);
  });

  it("styles every element's own root, and keeps a section's title styling out of it", () => {
    const missed: string[] = [];
    for (const type of placed("element")) {
      const def = siteLibrary.components[type];
      // Each with its defaults and a photo, so it draws something.
      const props: NodeDoc["props"] = { ...def?.defaults, id: "el", lookOpacity: "50" };
      for (const [name, field] of Object.entries(def?.fields ?? {})) {
        if (field.kind === "media") props[name] = { mediaId: "photo" };
      }
      const html = render([
        { type: "Section", props: { id: "band", lookUnderline: true, content: [{ type, props }] } },
      ]);
      // One that draws nothing by default (no image, profiles or address yet) has nothing to style.
      const inside = html.replace(/^<section[^>]*>|<\/section>$/g, "");
      if (inside !== "" && !inside.includes("opacity-50!")) missed.push(type);
      expect(html.replace(/<section[^>]*>/, ""), type).not.toContain("underline!");
      // The mark that says where never reaches a page, whichever element sets it.
      expect(html, type).not.toContain(LOOK_TARGET);
    }
    expect(missed).toEqual([]);
  });

  it("styles a Button's button and an Icon's drawing, not the row that aligns them (2.22b)", () => {
    const html = render([
      {
        type: "Button",
        props: { id: "b", label: "Book", link: "about", lookBackground: "accent" },
      },
      { type: "Icon", props: { id: "i", icon: "star", lookOpacity: "50" } },
    ]);
    expect(html).toMatch(/<div class="site-button [^"!]*"><a class="btn [^"]* bg-accent!"/);
    expect(html).toMatch(/<div class="site-icon [^"!]*"><svg[^>]* class="[^"]*opacity-50!"/);
    // The mark that says where never reaches a page.
    expect(html).not.toContain("data-wf-look");
  });

  it("finds the marked part among several children, at any depth", () => {
    const card = defineComponent({
      label: "Card",
      fields: {},
      defaults: {},
      lookTarget: true,
      render: () => (
        <div>
          <h3>One</h3>
          <p>
            <span>Two</span>
            <b {...{ [LOOK_TARGET]: "" }}>Three</b>
          </p>
        </div>
      ),
    });
    const html = renderToStaticMarkup(
      <>
        {card.render({
          id: "c",
          values: { lookShadow: "small" },
          slots: {},
          context: EDITOR_RENDER_CONTEXT,
        })}
      </>,
    );
    expect(html).toBe(
      '<div><h3>One</h3><p><span>Two</span><b class="shadow-sm!">Three</b></p></div>',
    );
  });

  it("finds the mark on the root itself, and in a list mapped from data (2.22b)", () => {
    const draw = (render: () => ReactNode) =>
      renderToStaticMarkup(
        <>
          {defineComponent({
            label: "Card",
            fields: {},
            defaults: {},
            lookTarget: true,
            render,
          }).render({
            id: "c",
            values: { lookShadow: "small" },
            slots: {},
            context: EDITOR_RENDER_CONTEXT,
          })}
        </>,
      );
    expect(draw(() => <div {...{ [LOOK_TARGET]: "" }}>One</div>)).toBe(
      '<div class="shadow-sm!">One</div>',
    );
    expect(
      draw(() => (
        <ul>
          {["a", "b"].map((name) => (
            <li key={name} {...(name === "b" ? { [LOOK_TARGET]: "" } : {})}>
              {name}
            </li>
          ))}
        </ul>
      )),
    ).toBe('<ul><li>a</li><li class="shadow-sm!">b</li></ul>');
  });

  it("looks for a mark only in an element that says it has one", () => {
    const html = renderToStaticMarkup(
      <>
        {defineComponent({
          label: "Card",
          fields: {},
          defaults: {},
          render: () => (
            <div>
              <b>One</b>
            </div>
          ),
        }).render({
          id: "c",
          values: { lookShadow: "small" },
          slots: {},
          context: EDITOR_RENDER_CONTEXT,
        })}
      </>,
    );
    expect(html).toBe('<div class="shadow-sm!"><b>One</b></div>');
  });

  it("keeps an element's several children a list as they were, with no key warnings", () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    try {
      const card = defineComponent({
        label: "Card",
        fields: {},
        defaults: {},
        render: () => (
          <div>
            <h3>One</h3>
            <p>Two</p>
            <p>Three</p>
          </div>
        ),
      });
      const html = renderToStaticMarkup(
        <>
          {card.render({
            id: "c",
            values: { lookShadow: "small" },
            slots: {},
            context: EDITOR_RENDER_CONTEXT,
          })}
        </>,
      );
      expect(html).toBe('<div class="shadow-sm!"><h3>One</h3><p>Two</p><p>Three</p></div>');
    } finally {
      spy.mockRestore();
    }
    expect(errors).toEqual([]);
  });

  it("has Text controls on a section only if it draws a title in some layout (2.22b)", () => {
    for (const type of placed("section")) {
      const def = siteLibrary.components[type];
      if (def === undefined) continue;
      const layouts =
        def.fields.variant?.kind === "select" ? def.fields.variant.options.map((o) => o.value) : [];
      const titled = (layouts.length === 0 ? [undefined] : layouts).some((variant) => {
        const props: NodeDoc["props"] = { ...def.defaults, id: "s", lookUnderline: true };
        if (variant !== undefined) props.variant = variant;
        return render([{ type, props }]).includes("underline!");
      });
      expect(Object.hasOwn(def.fields, "lookUnderline"), type).toBe(titled);
    }
  });

  it("shows Border colour only while a border is drawn on some device (2.22b)", () => {
    const hero = siteLibrary.components.Hero;
    if (hero === undefined) throw new Error("No Hero");
    expect(fieldsHiddenBy(hero, {}).has("lookBorderColor")).toBe(true);
    expect(fieldsHiddenBy(hero, { lookBorder: "none" }).has("lookBorderColor")).toBe(true);
    expect(fieldsHiddenBy(hero, { lookBorder: "thin" }).has("lookBorderColor")).toBe(false);
    expect(
      fieldsHiddenBy(hero, {
        lookBorder: { $responsive: { desktop: "none", mobile: "thick" } },
      }).has("lookBorderColor"),
    ).toBe(false);
  });

  it("darkens a Button with a colour of its own when hovered, unless its hover row says otherwise (2.22b)", () => {
    const button = (props: Readonly<Record<string, unknown>>) =>
      render([{ type: "Button", props: { id: "b", label: "Book", link: "about", ...props } }]);
    expect(button({})).not.toContain("hover:brightness-90");
    expect(button({ lookBackground: "primary-300" })).toContain("hover:brightness-90");
    expect(
      button({ lookColor: { $responsive: { desktop: "theme", mobile: "accent" } } }),
    ).toContain("hover:brightness-90");
    expect(button({ lookBackground: "primary-300", hover: "lift" })).not.toContain(
      "hover:brightness-90",
    );
  });

  it("darkens a Button only on the devices its colour is set for (2.22b)", () => {
    expect(
      whereOwnColour(
        { lookBackground: { $responsive: { desktop: "theme", mobile: "accent" } } },
        " transition-[filter] hover:brightness-90",
      ),
    ).toBe(" max-md:transition-[filter] max-md:hover:brightness-90");
    expect(whereOwnColour({ lookColor: "primary" }, " hover:brightness-90")).toBe(
      " hover:brightness-90",
    );
    expect(whereOwnColour({ lookColor: "theme" }, " hover:brightness-90")).toBe("");
  });

  it("keeps an Outline Button with a colour of its own unfilled when hovered (2.22b)", () => {
    const outline = (props: Readonly<Record<string, unknown>>) =>
      render([
        {
          type: "Button",
          props: { id: "b", label: "Book", link: "about", style: "outline", ...props },
        },
      ]);
    expect(outline({})).not.toContain("--btn-bg");
    for (const look of [{ lookColor: "primary" }, { lookBackground: "accent" }]) {
      const html = outline(look);
      expect(html).toContain("hover:[--btn-bg:#0000]!");
      expect(html).toContain("hover:[--btn-fg:var(--btn-color)]!");
      expect(html).toContain("hover:brightness-90");
    }
    // A filled button with a colour of its own only darkens.
    expect(
      render([
        { type: "Button", props: { id: "b", label: "Book", link: "about", lookColor: "accent" } },
      ]),
    ).not.toContain("--btn-bg");
  });

  it("offers Underline when hovered only where there is text of its own (2.22b)", () => {
    const options = (type: string) => {
      const field = siteLibrary.components[type]?.fields.hover;
      return field?.kind === "select" ? field.options.map((option) => option.value) : [];
    };
    expect(options("Button")).toContain("underline");
    for (const type of ["Image", "Icon"]) {
      expect(options(type), type).not.toContain("underline");
      expect(options(type), type).toContain("darken");
    }
  });

  it("refuses an element that declares one of its fields itself", () => {
    expect(() =>
      defineComponent({
        label: "Card",
        fields: { lookShadow: { kind: "toggle", label: "Shadow" } },
        defaults: {},
        render: () => <div />,
      }),
    ).toThrow(`'Card' declares its own "lookShadow": every element has it`);
  });
});
