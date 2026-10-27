import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { APPEARANCE_FIELDS, appearanceBoxClasses, appearanceTextClasses } from "./appearance.js";
import { siteLibrary } from "./catalogue/index.js";
import { defineComponent } from "./define.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
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
      expect(names.slice(0, Object.keys(APPEARANCE_FIELDS).length), type).toEqual(
        Object.keys(APPEARANCE_FIELDS),
      );
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
    ).toBe("text-h3! md:text-h1!");
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
    }
    expect(missed).toEqual([]);
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
