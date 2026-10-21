import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { layerItem, layersOf, moveLayer, renameLayer, setLayerHidden } from "./layers.js";

const heading = (id: string, extra: Record<string, unknown> = {}): NodeDoc => ({
  type: "Heading",
  props: { id, text: id, ...extra },
});

/** A page with two Sections, the first holding three elements. */
function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: {
        id: "s1",
        content: [heading("a"), heading("b", { layerName: "Hours" }), heading("c")],
      },
    },
    { type: "Section", props: { id: "s2", content: [], hidden: true } },
  ];
  const session = createEditorSession(siteLibrary, {
    ...site,
    pages: { ...site.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
  });
  const ids = (list: readonly NodeDoc[] | undefined) => list?.map((node) => node.props.id);
  const first = () => currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, first, ids, labels };
}

describe("layersOf (F-ED-12)", () => {
  it("gives sections and their elements, with names and hidden flags", () => {
    const { session } = setUp();

    const layers = layersOf(currentPage(session)?.doc.content ?? [], siteLibrary);

    expect(layers.map(({ id, kind, hidden }) => [id, kind, hidden])).toEqual([
      ["s1", "Section", false],
      ["s2", "Section", true],
    ]);
    expect(layers[0]?.children.map(({ id, name }) => [id, name])).toEqual([
      ["a", undefined],
      ["b", "Hours"],
      ["c", undefined],
    ]);
    expect(layerItem({ kind: "Heading", name: "Hours" })).toBe("'Hours'");
    expect(layerItem({ kind: "Heading", name: undefined })).toBe("Heading");
  });

  it("names unknown components by their type, and treats a blank name as none", () => {
    const layers = layersOf(
      [{ type: "Gallery", props: { id: "g", layerName: "  " } }],
      siteLibrary,
    );

    expect(layers).toEqual([
      { id: "g", kind: "Gallery", name: undefined, hidden: false, children: [] },
    ]);
  });
});

describe("Layers changes, one undo step each", () => {
  it("moves a layer among its siblings and keeps it selected", () => {
    const { session, first, ids, labels } = setUp();

    moveLayer(session, "a", 2);

    expect(ids(first())).toEqual(["b", "c", "a"]);
    expect(labels()).toEqual(["Moved Heading"]);
    expect(session.ui.getState().nodeId).toBe("a");
    session.history.undo();
    expect(ids(first())).toEqual(["a", "b", "c"]);

    moveLayer(session, "b", 0);
    expect(labels().at(-1)).toBe("Moved 'Hours'");
    for (const index of [-1, 3, 0]) moveLayer(session, "b", index);
    moveLayer(session, "missing", 0);
    expect(labels()).toHaveLength(1);
  });

  it("names a layer, and removes the name when it's emptied", () => {
    const { session, first, labels } = setUp();

    renameLayer(session, "a", " Opening times ");
    renameLayer(session, "a", "Opening times");
    expect(first()?.[0]?.props.layerName).toBe("Opening times");
    renameLayer(session, "a", "  ");

    expect(first()?.[0]?.props).not.toHaveProperty("layerName");
    expect(labels()).toEqual([
      "Renamed Heading to 'Opening times'",
      "Removed the name of 'Opening times'",
    ]);
  });

  it("hides a layer and shows it again", () => {
    const { session, first, labels } = setUp();

    setLayerHidden(session, "b", true);
    setLayerHidden(session, "b", true);
    expect(first()?.[1]?.props.hidden).toBe(true);
    setLayerHidden(session, "b", false);
    setLayerHidden(session, "s2", false);

    expect(first()?.[1]?.props).not.toHaveProperty("hidden");
    expect(labels()).toEqual(["Hid 'Hours'", "Showed 'Hours'", "Showed Section"]);
  });
});
