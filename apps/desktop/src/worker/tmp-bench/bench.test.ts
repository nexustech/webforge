import { createPipeline } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { fontFacesFor } from "@webforge/themes";
import { it } from "vitest";
import { createPreviewBuilds } from "../run-preview.js";

it("times preview builds", async () => {
  const resources = await loadNodeResources();
  const site = sampleSite();
  const fonts = await Promise.all(
    fontFacesFor(site.theme).map(async (face) => ({
      file: face.file,
      data: (await resources.readFont(face)) ?? new Uint8Array(),
    })),
  );
  const pipeline = createPipeline(siteLibrary);
  const preview = createPreviewBuilds(loadNodeResources, {
    readMedia: async () => undefined,
    pipeline,
  });
  const run = async (label: string, snapshot: typeof site) => {
    const t0 = performance.now();
    const events: string[] = [];
    let last = t0;
    for await (const e of pipeline.build(
      snapshot,
      {
        ...resources,
        readFont: async (f: { file: string }) => fonts.find((x) => x.file === f.file)?.data,
        readMedia: async () => undefined,
      },
      { mode: "preview" },
    )) {
      const now = performance.now();
      events.push(`${e.stage}+${Math.round(now - last)}`);
      last = now;
    }
    console.log(label, Math.round(performance.now() - t0), "ms", events.join(" "));
  };
  await run("first", site);
  await run("same", site);
  for (let i = 0; i < 3; i++) {
    const recoloured = {
      ...site,
      theme: {
        ...site.theme,
        colors: { ...site.theme.colors, primary: { l: 0.4 + i * 0.05, c: 0.2, h: 20 } },
      },
    };
    await run(`colour ${i}`, recoloured);
  }
  const t = performance.now();
  await preview({ type: "preview", snapshot: site, fonts, families: [] });
  console.log("preview job", Math.round(performance.now() - t));
}, 120_000);
