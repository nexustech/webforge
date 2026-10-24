import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { areaCycles, areaCyclesIn, areaGraph } from "./check-area-cycles.js";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A renderer folder on disk with `files` (path → text). */
function renderer(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "webforge-areas-"));
  folders.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

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

describe("areaCyclesIn", () => {
  it("reads the areas from disk, leaving out shell/, editor/, tests and stories", () => {
    const folder = renderer({
      "site/SitePanel.tsx": 'import { MenuPanel } from "../menu/index.js";',
      "menu/MenuPanel.tsx": 'import { LinkDialog } from "../links/index.js";',
      "links/index.ts": 'export { LinkDialog } from "./LinkDialog.js";',
      // A test may bring two areas together; it makes no cycle.
      "menu/MenuPanel.test.tsx": 'import { SitePanel } from "../site/index.js";',
      "menu/MenuPanel.stories.tsx": 'import { SitePanel } from "../site/index.js";',
      "editor/Editor.tsx": 'import { SitePanel } from "../site/index.js";',
      "shell/Shell.tsx": 'import { MenuPanel } from "../menu/index.js";',
    });

    expect(areaCyclesIn(folder)).toEqual({ areas: 3, cycles: [] });
  });

  it("finds a cycle in production code", () => {
    const folder = renderer({
      "site/SitePanel.tsx": 'import { MenuPanel } from "../menu/index.js";',
      "menu/nested/MenuPanel.tsx": 'import { NameDialog } from "../../site/index.js";',
      "menu/menu-actions.ts": 'import { addPage } from "../site/index.js";',
    });

    expect(areaCyclesIn(folder).cycles).toEqual([["menu", "site", "menu"]]);
  });
});
