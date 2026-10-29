// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { type ComponentDef, type FieldDef, siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { starterSite } from "../../../shared/starter-site.js";
import { lookFieldsOf } from "../../clipboard/index.js";
import { createPreferencesStore } from "../../shell/preferences-store.js";
import { sessionWith } from "../../testing/fixtures.js";
import { StyleGroups } from "./StyleGroups.js";

// Phase 3's exit (spec/04, #622): every Appearance control says where its value comes from (3.12,
// CT-3), for an element and a section: its own value, its kind's look in the theme, or the theme's.
// Checked on every field a look holds (`lookFieldsOf`), as *Style this ‹kind›…* shows them all.

afterEach(cleanup);

/** The items checked: an element and a section. */
const ITEMS = [
  { type: "Heading", place: "an element" },
  { type: "Hero", place: "a section" },
] as const;

/** The gradient's fields, which draw the background as a gradient once set (CT-4). */
const GRADIENT = ["lookGradientDirection", "lookGradientFrom", "lookGradientTo"];

/** `type`'s definition. */
function defOf(type: string): ComponentDef {
  const def = siteLibrary.components[type];
  if (def === undefined) throw new Error(`no ${type}`);
  return def;
}

/**
 * A value for `field` that isn't the theme's own, nor *None*, which hides what depends on it (a
 * border's colour): its first other choice, or on for a toggle.
 */
function aValue(field: FieldDef | undefined): unknown {
  if (field?.kind === "toggle") return true;
  const options =
    field !== undefined && "options" in field
      ? field.options
      : field !== undefined && "steps" in field
        ? field.steps
        : [];
  return options?.find((option) => !["default", "theme", "none", ""].includes(String(option.value)))
    ?.value;
}

/** `names` of `type`, each with a value of its own. */
function values(type: string, names: readonly string[]): Record<string, unknown> {
  const { fields } = defOf(type);
  return Object.fromEntries(names.map((name) => [name, aValue(fields[name])]));
}

/**
 * The fields *Style this* shows for an item of `type`, each with the words its source says, once the
 * item sets `own` and the theme's look for its kind sets `look`.
 */
function sources(
  type: string,
  { own = {}, look = {} }: { own?: Record<string, unknown>; look?: Record<string, unknown> },
): Map<string, string | undefined> {
  const site: SiteDoc = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const item: NodeDoc = { type, props: { ...defOf(type).defaults, ...own, id: "item" } };
  home.doc.content =
    type === "Hero" ? [item] : [{ type: "Section", props: { id: "s", content: [item] } }];
  site.theme.looks = { [type]: look };
  const session = sessionWith(site);
  session.select("item");
  render(<StyleGroups session={session} preferences={createPreferencesStore()} />);
  const shown = new Map<string, string | undefined>();
  for (const field of document.querySelectorAll("[data-field]")) {
    const name = field.getAttribute("data-field");
    const source = field.querySelector("[data-source]")?.textContent;
    if (name !== null) shown.set(name, source ?? undefined);
  }
  cleanup();
  return shown;
}

describe("every Appearance control says where its value comes from (3.12, #622)", () => {
  describe.each(ITEMS)("on $place, $type", ({ type }) => {
    const { label } = defOf(type);
    const fields = lookFieldsOf(defOf(type));
    /** Every field but the gradient's, which turn the background into a gradient. */
    const plain = fields.filter((name) => !GRADIENT.includes(name));

    it("shows every field a look holds", () => {
      expect(fields.length).toBeGreaterThan(20);
      // A border's colour shows once it has a border: everything set, everything shows.
      const shown = sources(type, { own: values(type, fields) });
      expect(fields.filter((name) => !shown.has(name))).toEqual([]);
    });

    it("says each is set here when the item sets it", () => {
      const shown = sources(type, { own: values(type, plain) });
      expect(plain.filter((name) => shown.get(name) !== "Set here")).toEqual([]);
    });

    it("says each comes from the kind's look when only the look sets it", () => {
      const shown = sources(type, { look: values(type, plain) });
      expect(plain.filter((name) => shown.get(name) !== `Theme's look for ${label}`)).toEqual([]);
    });

    it("says a gradient's fields are set here, and the background is drawn as one (CT-4)", () => {
      const own = sources(type, { own: values(type, GRADIENT) });
      expect(GRADIENT.map((name) => own.get(name))).toEqual(["Set here", "Set here", "Set here"]);
      expect(own.get("lookBackground")).toBe("Gradient (set under Background)");
      const look = sources(type, { look: values(type, GRADIENT) });
      expect(GRADIENT.filter((name) => look.get(name) !== `Theme's look for ${label}`)).toEqual([]);
    });

    it("names the theme's token where one decides it, and says nothing more where none does", () => {
      const shown = sources(type, {});
      // Nothing set: the theme's token in words where one decides the value; elsewhere the
      // control's own *Theme's* says it all (#567).
      expect(
        fields.filter((name) => {
          const said = shown.get(name);
          return said !== undefined && !said.startsWith("Theme's (");
        }),
      ).toEqual([]);
      expect(shown.get("lookShadow")).toMatch(/^Theme's \(Shadow: /);
      expect(shown.get("lookBorder")).toMatch(/^Theme's \(Border: /);
    });
  });
});
