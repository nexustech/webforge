import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUSINESS_TYPES } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { TEMPLATES_DIR } from "../src/node.js";
import { TEMPLATE_IDS, TEMPLATE_MANIFESTS } from "../src/template-index.js";

/** Each folder of `templates/`: its name, and its `template.json`'s business type. */
const folders = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(({ name }) => {
    const json = JSON.parse(readFileSync(join(TEMPLATES_DIR, name, "template.json"), "utf8")) as {
      readonly category: string | null;
    };
    return { id: name, category: json.category };
  });

describe("the template index (#983)", () => {
  it("is every folder of templates/, in New Site's order: after adding one, run `pnpm template-index`", () => {
    const rank = (category: string | null) =>
      category === null ? BUSINESS_TYPES.length : BUSINESS_TYPES.indexOf(category as never);
    const ordered = folders
      .toSorted((a, b) => rank(a.category) - rank(b.category) || a.id.localeCompare(b.id))
      .map(({ id }) => id);
    expect([...TEMPLATE_IDS]).toEqual(ordered);
  });

  it("has each template's images.json as it is", () => {
    expect(Object.keys(TEMPLATE_MANIFESTS).toSorted()).toEqual([...TEMPLATE_IDS].toSorted());
    for (const id of TEMPLATE_IDS) {
      const file = JSON.parse(readFileSync(join(TEMPLATES_DIR, id, "images.json"), "utf8"));
      expect(TEMPLATE_MANIFESTS[id], id).toEqual(file);
    }
  });
});
