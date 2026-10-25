import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME, siteDocSchema } from "@webforge/model";
import { siteLibrary, walkNodes } from "@webforge/site-components";
import { THEME_PRESETS } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { readTemplates } from "../src/node.js";
import {
  imageManifestSchema,
  siteFromTemplate,
  TEMPLATE_IDS,
  templateImageSchema,
  templateSchema,
} from "../src/template.js";

const templates = readTemplates();

/** The width and height a JPEG or PNG says it has, from its header. */
function dimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments to the frame header (SOF0–SOF15, not DHT, JPG or DAC).
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes[at + 1] ?? 0;
    const length = view.getUint16(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
    }
    at += 2 + length;
  }
  throw new Error("No frame header");
}

describe("the shipped templates (2.14a)", () => {
  it("are every listed template, each passing its schemas", () => {
    expect(templates.map((folder) => folder.template.id)).toEqual([...TEMPLATE_IDS]);
  });

  it("list every image they have, as the files are: hash, type and size (S5)", () => {
    for (const { template, images, imagesDir } of templates) {
      expect(readdirSync(imagesDir).toSorted(), template.id).toEqual(
        images.map((image) => image.file).toSorted(),
      );
      for (const image of images) {
        const bytes = new Uint8Array(readFileSync(join(imagesDir, image.file)));
        expect(createHash("sha256").update(bytes).digest("hex"), image.file).toBe(image.hash);
        expect(dimensions(bytes), image.file).toEqual({ width: image.width, height: image.height });
        expect(image.mimeType, image.file).toBe(
          image.file.endsWith(".png") ? "image/png" : "image/jpeg",
        );
      }
    }
  });

  it("use only components the catalogue has, and images their manifest lists", () => {
    for (const { template, images } of templates) {
      const { site } = template;
      const ids = new Set(images.map((image) => image.mediaId));
      const nodes = [
        ...Object.values(site.pages).flatMap((page) => page.doc.content),
        ...site.layout.header,
        ...site.layout.footer,
      ];
      // Throws for a component the catalogue doesn't have.
      walkNodes(nodes, siteLibrary, (node) => {
        for (const value of Object.values(node.props)) {
          const mediaId = (value as { readonly mediaId?: unknown } | null)?.mediaId;
          if (typeof mediaId === "string")
            expect(ids, `${template.id} ${node.type}`).toContain(mediaId);
        }
      });
    }
  });

  it("offer at least one example for Try an example (PG-3)", () => {
    expect(templates.some(({ template }) => template.example)).toBe(true);
  });
});

describe("the image-licence manifest (S5)", () => {
  const image = {
    file: "shop.jpg",
    mediaId: "abcdefghijklmnop",
    name: "shop",
    mimeType: "image/jpeg",
    hash: "a".repeat(64),
    width: 10,
    height: 10,
    alt: "",
    source: "https://example.com/shop",
    author: "Someone",
    licence: "CC0-1.0",
  };

  it("refuses an image without its source, author or licence, or under another licence", () => {
    expect(templateImageSchema.safeParse(image).success).toBe(true);
    for (const key of ["source", "author", "licence"] as const) {
      const { [key]: _left, ...without } = image;
      expect(templateImageSchema.safeParse(without).success, key).toBe(false);
    }
    expect(templateImageSchema.safeParse({ ...image, licence: "CC-BY-4.0" }).success).toBe(false);
  });

  it("refuses a file or a Media id listed twice", () => {
    expect(imageManifestSchema.safeParse([image, image]).success).toBe(false);
    expect(imageManifestSchema.safeParse([image, { ...image, file: "other.jpg" }]).success).toBe(
      false,
    );
  });

  it("keeps images out of a template's own Media", () => {
    const [{ template }] = templates as [(typeof templates)[number]];
    const withMedia = structuredClone(template);
    const [first] = templates[0]?.images ?? [];
    if (first === undefined) throw new Error("The sample template has no image");
    withMedia.site.media = siteFromTemplate(template, [first], {
      name: "x",
      theme: DEFAULT_THEME,
    }).media;
    expect(templateSchema.safeParse(withMedia).success).toBe(false);
  });
});

describe("siteFromTemplate (2.14a)", () => {
  it("makes the template's site, named and in the chosen theme, with its images in Media", () => {
    const [{ template, images }] = templates as [(typeof templates)[number]];
    const theme = THEME_PRESETS.find((preset) => preset.preset === "dark") ?? DEFAULT_THEME;

    const site = siteFromTemplate(template, images, { name: "Rosa's Bakery", theme });

    expect(siteDocSchema.parse(site)).toEqual(site);
    expect(site.settings.general.name).toBe("Rosa's Bakery");
    expect(site.theme).toEqual(theme);
    expect(site.theme).not.toBe(theme);
    expect(Object.keys(site.media).toSorted()).toEqual(
      images.map((image) => image.mediaId).toSorted(),
    );
    // The template itself is left as it was.
    expect(Object.keys(template.site.media)).toHaveLength(0);
  });
});
