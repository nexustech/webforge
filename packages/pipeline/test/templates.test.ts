import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteToSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { siteFromTemplate } from "@webforge/templates";
import { readTemplates } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../src/build.js";
import { createMemoryImageCache } from "../src/memory-image-cache.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

// Every template's export, as a site made from it starts (3.3): its pages as reviewed golden files,
// and the files it writes. A change to a component, a theme or the pipeline that changes an
// exported page shows up here, to review and accept with `vitest -u`.

let resources: PipelineResources;

beforeAll(async () => {
  resources = { ...(await loadNodeResources()), imageCache: createMemoryImageCache(512 << 20) };
}, 60_000);

describe.each(readTemplates().map((folder) => [folder.template.id, folder] as const))(
  "the %s template's export",
  (id, { template, images, imagesDir }) => {
    it("writes the reviewed pages and files", async () => {
      const theme = themePreset(template.site.theme.preset) ?? template.site.theme;
      const site = siteFromTemplate(template, images, {
        name: template.site.settings.general.name,
        theme,
      });
      const blobs = new Map(
        images.map((image) => [
          image.hash,
          new Uint8Array(readFileSync(join(imagesDir, image.file))),
        ]),
      );

      const built = await buildSite(siteToSnapshot(site, blobs), siteLibrary, resources);

      expect([...built.files.keys()]).toMatchSnapshot();
      expect(built.report.warnings).toEqual([]);
      for (const [path, data] of built.files) {
        if (!path.endsWith(".html")) continue;
        await expect(new TextDecoder().decode(data)).toMatchFileSnapshot(
          `golden/templates/${id}/${path}`,
        );
      }
    }, 120_000);
  },
);
