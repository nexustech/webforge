import type { SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { createMemoryImageCache } from "../src/memory-image-cache.js";
import { loadNodeResources } from "../src/node-resources.js";

// The Header's own button (HF-2, 5.38). Format 19 gives a split Header, _With a button_, the menu's
// last link as its own button. The golden files are the pages as format 18 exported them, with that
// rule, before the button was the Header's: the migrated Header and the Footer must export the same.

/** The sample site, its Header split: the menu's last item is its button "Order a cake". */
function migrated(): SiteSnapshot {
  const site = sampleSite();
  const about = site.pages.find((page) => page.path === "about")?.id ?? "";
  return {
    ...site,
    layout: {
      ...site.layout,
      header: site.layout.header.map((node) =>
        node.type === "Header"
          ? {
              ...node,
              props: {
                ...node.props,
                variant: "split",
                button: true,
                buttonLabel: "Order a cake",
                buttonLink: { kind: "page", pageId: about },
              },
            }
          : node,
      ),
    },
  };
}

let built: BuiltSite;

beforeAll(async () => {
  const resources = await loadNodeResources();
  built = await buildSite(migrated(), siteLibrary, {
    ...resources,
    imageCache: createMemoryImageCache(64 * 1024 * 1024),
  });
}, scaledTestTimeout(120_000));

const text = (path: string) => new TextDecoder().decode(built.files.get(path));

describe("a split Header after format 19 (HF-2)", () => {
  it("exports its Header and Footer as format 18 did", async () => {
    for (const page of ["index.html", "about.html"]) {
      const html = text(page);
      const header = /<header[\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
      const footer = /<footer[\s\S]*?<\/footer>/.exec(html)?.[0] ?? "";
      await expect(`${header}
${footer}
`).toMatchFileSnapshot(`golden/split-header/${page}`);
    }
  });
});
