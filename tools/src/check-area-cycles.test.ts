import { describe, expect, it } from "vitest";
import { areaCycles, areaGraph } from "./check-area-cycles.js";

/** Areas from their files' import lines. */
const graphOf = (areas: Record<string, readonly string[]>) =>
  areaGraph(new Map(Object.entries(areas)));

describe("check-area-cycles (2.20, B2)", () => {
  it("finds which areas each area imports, leaving out shell/, editor/ and itself", () => {
    const graph = graphOf({
      menu: [
        'import { LinkDialog } from "../links/index.js";',
        'import { cn } from "../shell/cn.js";',
        'import { t } from "../editor/labels.js";',
        'import { own } from "../menu/own.js";',
      ],
      links: ['import { x } from "@webforge/model";'],
    });

    expect(graph.get("menu")).toEqual(new Set(["links"]));
    expect(graph.get("links")).toEqual(new Set());
  });

  it("finds a cycle between two areas, and one through a third, once each", () => {
    const cycles = areaCycles(
      graphOf({
        site: ['import { MenuPanel } from "../menu/index.js";'],
        menu: ['import { NameDialog } from "../site/index.js";'],
        links: ['import { a } from "../shared/index.js";'],
        shared: ['import { b } from "../extra/index.js";'],
        extra: ['import { c } from "../links/index.js";'],
      }),
    );

    expect(cycles).toEqual([
      ["extra", "links", "shared", "extra"],
      ["menu", "site", "menu"],
    ]);
  });

  it("finds none when the areas only build on each other one way", () => {
    expect(
      areaCycles(
        graphOf({
          site: ['import { MenuPanel } from "../menu/index.js";'],
          menu: ['import { LinkDialog } from "../links/index.js";'],
          links: [],
        }),
      ),
    ).toEqual([]);
  });
});
