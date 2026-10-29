import { LOOK_FIELDS, type NodeDoc } from "@webforge/model";
import {
  appearanceBoxClasses,
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  renderNodesToHtml,
  siteLibrary,
} from "@webforge/site-components";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toPuckConfig } from "./config.js";

// Phase 3's exit (spec/04, #622): a kind's look in the theme (3.12, CT-1) restyles every kind, on
// the canvas as in the export. For each kind that holds a look, its shadow from the look draws on an
// item that sets none itself, and an item's own shadow wins over it.

/** Every kind in the catalogue that holds a look, with its fields. */
const KINDS = Object.entries(siteLibrary.components).filter(([, def]) =>
  Object.keys(def.fields).some((name) => (LOOK_FIELDS as readonly string[]).includes(name)),
);

/** The shadow the look gives, and the one an item sets itself instead. */
const FROM_LOOK = appearanceBoxClasses({ lookShadow: "large" });
const OWN = appearanceBoxClasses({ lookShadow: "small" });

/** What the kinds that draw nothing without content are given: a picture, a video, a map. */
const CONTENT: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  Image: { image: { mediaId: "photo", alt: "Loaves" } },
  EmbedVideo: { address: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
  EmbedMap: { address: "1 High Street, Hightown" },
};

/** An item of `type` with its defaults and any content it needs, and `own` set on it. */
function item(type: string, own: Readonly<Record<string, unknown>> = {}): NodeDoc {
  const defaults = siteLibrary.components[type]?.defaults ?? {};
  return { type, props: { ...defaults, ...CONTENT[type], ...own, id: `${type}-1` } };
}

/**
 * The context with `type`'s look in the theme, a large shadow, where a picture resolves and the
 * site has a social profile (Social links draw nothing without one).
 */
const lookFor = (type: string): RenderContext => ({
  ...EDITOR_RENDER_CONTEXT,
  image: () => ({
    sources: [],
    src: "photo.jpg",
    fallback: { type: "image/jpeg", srcset: "" },
    width: 800,
    height: 600,
    alt: "Loaves",
  }),
  socialProfiles: [{ network: "instagram", url: "https://instagram.com/rosasbakery" }],
  looks: { [type]: { lookShadow: "large" } },
});

/** `node` drawn as the export draws it. */
const exported = (node: NodeDoc, context: RenderContext) =>
  renderNodesToHtml([node], siteLibrary, context);

/** `node` drawn as the canvas draws it, through the Puck config the engine gives Puck. */
function onCanvas(node: NodeDoc, context: RenderContext): string {
  const config = toPuckConfig(
    siteLibrary,
    () => 0,
    () => context,
  );
  const render = config.components[node.type]?.render as
    | ((props: Record<string, unknown>) => ReactNode)
    | undefined;
  if (render === undefined) throw new Error(`no Puck component for ${node.type}`);
  return renderToStaticMarkup(<>{render({ ...node.props, puck: {} })}</>);
}

describe("a kind's look, for every kind that holds one (3.12, #622)", () => {
  it("is checked for every section and element", () => {
    expect(KINDS.length).toBeGreaterThan(25);
    expect(FROM_LOOK).not.toBe(OWN);
  });

  describe.each(KINDS.map(([type]) => type))("%s", (type) => {
    it.each([
      ["in the export", exported],
      ["on the canvas", onCanvas],
    ])(
      "draws its look on an item without its own value, and not on one with its own, %s",
      (_where, draw) => {
        const context = lookFor(type);

        expect(draw(item(type), context)).toContain(FROM_LOOK);
        const own = draw(item(type, { lookShadow: "small" }), context);
        expect(own).toContain(OWN);
        expect(own).not.toContain(FROM_LOOK);
      },
    );
  });
});
