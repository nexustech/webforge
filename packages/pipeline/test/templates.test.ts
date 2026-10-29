import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUSINESS_KINDS, siteToSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { siteFromTemplate } from "@webforge/templates";
import { readTemplates } from "@webforge/templates/node";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { THEME_PRESETS, themePreset } from "@webforge/themes";
import { transform } from "lightningcss";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSite } from "../src/build.js";
import { buildSiteCss, classCandidates } from "../src/css.js";
import { minifiedCss } from "../src/minify.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { ImageCache, PipelineResources } from "../src/resources.js";
import { businessDataSchema, websiteDataSchema } from "../src/structured-data.js";

// Every template's export, as a site made from it starts (3.3): its pages as reviewed golden files,
// and the files it writes. A change to a component, a theme or the pipeline that changes an
// exported page shows up here, to review and accept with `vitest -u`.
//
// A page depends on its images' sizes, not on their encoded bytes. So the image cache here answers
// each image's plan from its file's header, and gives stand-in bytes for its encodings: the pages
// are exactly what a real export writes, without encoding some 60 photos (about 145 s). The
// encodings themselves are tested with the sample site (build.test.ts) and in images.test.ts. If
// the cache's keys or plan change, nothing is found here and the build encodes for real: slower,
// never wrong.

let resources: PipelineResources;

/**
 * `css` parsed and minified again by lightningcss: two stylesheets that mean the same give the same.
 * lightningcss keeps what it doesn't parse fully (`color-mix(in lab, red, red)` in `@supports`) as
 * written, so whitespace beside commas and brackets, which never matters there, is left out.
 */
const normalised = (css: string) =>
  new TextDecoder()
    .decode(
      transform({ filename: "site.css", code: new TextEncoder().encode(css), minify: true }).code,
    )
    .replace(/\s*([,()])\s*/g, "$1");

/** Every class the templates' pages use, gathered as each is built, for the themes' check. */
const everyClass = new Set<string>();

beforeAll(async () => {
  resources = await loadNodeResources();
}, scaledTestTimeout(60_000));

/** An image's width and height from its PNG or JPEG header; `undefined` for anything else. */
function sizeOf(data: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data[0] === 0x89 && data[1] === 0x50) {
    // PNG: IHDR is the first chunk. A colour type with alpha could be transparent: not answered.
    const colourType = data[25];
    if (colourType === 4 || colourType === 6) return undefined;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let at = 2;
    while (at + 9 < data.length) {
      const marker = data[at + 1] ?? 0;
      const length = view.getUint16(at + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
      at += 2 + length;
    }
  }
  return undefined;
}

/** A cache that knows `images`' plans, by SHA-256, and stands in for every encoding. */
function plansOnly(images: ReadonlyMap<string, Uint8Array>): ImageCache {
  const plans = new Map(
    [...images].flatMap(([hash, data]) => {
      const size = sizeOf(data);
      return size === undefined ? [] : [[hash, { ...size, transparent: false }] as const];
    }),
  );
  return {
    async get(key) {
      const [part, crop, hash] = key.split("/").reverse();
      if (crop !== "whole" || hash === undefined || !plans.has(hash)) return undefined;
      return part === "plan"
        ? new TextEncoder().encode(JSON.stringify(plans.get(hash)))
        : new Uint8Array([0]);
    },
    async set() {},
  };
}

/** The JSON-LD objects an exported page carries, parsed (3.15, SEO-1). */
function structuredDataOf(html: string): unknown[] {
  const tags = html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g);
  return [...tags].map((match) => JSON.parse(match[1] ?? "null") as unknown);
}

describe.each(readTemplates().map((folder) => [folder.template.id, folder] as const))(
  "the %s template's export",
  (id, { template, images, imagesDir }) => {
    const theme = themePreset(template.site.theme.preset) ?? template.site.theme;
    const site = siteFromTemplate(template, images, {
      name: template.site.settings.general.name,
      theme,
    });
    /** The site built once for both tests, as a new site from the template exports. */
    let building: ReturnType<typeof buildSite> | undefined;
    const build = () => {
      const blobs = new Map(
        images.map((image) => [
          image.hash,
          new Uint8Array(readFileSync(join(imagesDir, image.file))),
        ]),
      );
      building ??= buildSite(siteToSnapshot(site, blobs), siteLibrary, {
        ...resources,
        imageCache: plansOnly(blobs),
      });
      return building;
    };
    const page = async (path: string) => {
      const data = (await build()).files.get(path);
      return data === undefined ? undefined : new TextDecoder().decode(data);
    };

    it(
      "writes the reviewed pages and files",
      async () => {
        const built = await build();

        expect([...built.files.keys()]).toMatchSnapshot();
        // A new site from a template has no form service yet, nor a Newsletter its address: its
        // forms say so (3.7), and nothing else does.
        for (const warning of built.report.warnings) {
          expect(warning, id).toMatchObject({ code: "form-unset" });
          expect(["noService", "noAddress"], id).toContain(warning.detail);
        }
        for (const [path, data] of built.files) {
          const text = new TextDecoder().decode(data);
          if (path.endsWith(".css")) {
            // Minify output's stylesheet means the same (3.3).
            expect(normalised(minifiedCss(text)), path).toBe(normalised(text));
          }
          if (!path.endsWith(".html")) continue;
          for (const name of classCandidates(text)) everyClass.add(name);
          await expect(text).toMatchFileSnapshot(`golden/templates/${id}/${path}`);
        }
      },
      scaledTestTimeout(60_000),
    );

    it(
      "marks up its home page for search engines from its Site Settings (SEO-1, #621)",
      async () => {
        const { general, contact } = site.settings;
        const [website, business, ...more] = structuredDataOf((await page("index.html")) ?? "");
        expect(websiteDataSchema.parse(website)).toMatchObject({
          "@type": "WebSite",
          name: general.name,
        });
        expect(more).toEqual([]);
        // A personal site, and Blank with no type, address or hours, is a website only.
        const type = general.businessType;
        if (type === undefined || type === "personal") {
          expect(business, id).toBeUndefined();
          return;
        }
        const kinds: readonly string[] = BUSINESS_KINDS[type];
        const data = businessDataSchema.parse(business);
        expect(data, id).toMatchObject({
          "@type": general.businessKind ?? kinds[0],
          name: contact.businessName ?? general.name,
        });
        // Only what the page shows, and as its Site Settings say it.
        if (data.telephone !== undefined) expect(data.telephone).toBe(contact.phone);
        if (data.email !== undefined) expect(data.email).toBe(contact.email);
        if (data.address !== undefined) {
          expect(contact.address).toContain(data.address.streetAddress);
        }

        // The page with its opening hours and contact details carries all of them.
        const built = await build();
        const contactPage = [...built.files.keys()].find(
          (path) =>
            path.endsWith(".html") &&
            path !== "index.html" &&
            structuredDataOf(new TextDecoder().decode(built.files.get(path))).length > 0,
        );
        if (contactPage === undefined) return;
        const [shown] = structuredDataOf((await page(contactPage)) ?? "");
        const details = businessDataSchema.parse(shown);
        expect(details.telephone, contactPage).toBe(contact.phone);
        expect(details.email, contactPage).toBe(contact.email);
        if (contact.address === undefined) {
          expect(details.address).toBeUndefined();
        } else {
          // The street, the town and the postcode, from the address as typed.
          const street = details.address?.streetAddress ?? "";
          expect(street.length, contactPage).toBeGreaterThan(0);
          expect(contact.address.startsWith(street), contactPage).toBe(true);
          expect(details.address?.addressLocality, contactPage).toBeDefined();
          expect(details.address?.postalCode, contactPage).toBeDefined();
        }
        expect(details.openingHoursSpecification?.length ?? 0, contactPage).toBe(
          contact.openingHours.length,
        );
      },
      scaledTestTimeout(60_000),
    );
  },
);

describe("every theme's stylesheet, minified (3.3)", () => {
  it.each(THEME_PRESETS.map((theme) => [theme.preset, theme] as const))(
    "means the same in %s",
    async (_name, theme) => {
      // The templates' classes, or a sample of the theme's own when this runs alone.
      const candidates = everyClass.size > 0 ? [...everyClass] : ["btn", "card", "site-heading"];
      const css = await buildSiteCss(resources, { theme, candidates, fontsUrl: "../fonts/" });

      expect(normalised(minifiedCss(css))).toBe(normalised(css));
    },
    30_000,
  );
});
