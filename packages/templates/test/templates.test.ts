import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME, SITE_FORMAT_VERSION, siteDocSchema } from "@webforge/model";
import { siteLibrary, walkNodes } from "@webforge/site-components";
import { THEME_PRESETS } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { readTemplate, readTemplates, TEMPLATES_DIR } from "../src/node.js";
import {
  BLANK_TEMPLATE_ID,
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
      // Blank has no photos, so no images/ folder (git keeps no empty folder).
      const files = existsSync(imagesDir) ? readdirSync(imagesDir) : [];
      expect(files.toSorted(), template.id).toEqual(images.map((image) => image.file).toSorted());
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

  it("open in the current format, whatever format they were written in", () => {
    for (const { template } of templates) {
      expect(template.site.formatVersion, template.id).toBe(SITE_FORMAT_VERSION);
    }
  });

  it("migrate a site of an older format as a site file is, and refuse a newer one", () => {
    const raw = JSON.parse(readFileSync(join(TEMPLATES_DIR, "blank", "template.json"), "utf8")) as {
      site: Record<string, unknown>;
    };
    // Format 5 → 6 only changes a Section's padding sizes, which Blank's don't depend on.
    const older = templateSchema.parse({ ...raw, site: { ...raw.site, formatVersion: 5 } });

    expect(older.site.formatVersion).toBe(SITE_FORMAT_VERSION);
    expect(
      templateSchema.safeParse({ ...raw, site: { ...raw.site, formatVersion: 99 } }).success,
    ).toBe(false);
    expect(templateSchema.safeParse({ ...raw, site: "not a site" }).success).toBe(false);
  });

  it("each have a thumbnail of their home page at desktop width (2.14b)", () => {
    for (const { template, thumbnail } of templates) {
      expect(existsSync(thumbnail), `${template.id}: run pnpm template-thumbnails`).toBe(true);
      expect(dimensions(new Uint8Array(readFileSync(thumbnail))), template.id).toEqual({
        width: 1280,
        height: 800,
      });
    }
  });

  it("offer at least one example for Try an example (PG-3)", () => {
    expect(templates.some(({ template }) => template.example)).toBe(true);
  });

  it("have a business type, all but Blank (2.15c)", () => {
    for (const { template } of templates) {
      expect(template.category === null, template.id).toBe(template.id === BLANK_TEMPLATE_ID);
    }
    const [{ template }] = templates as [(typeof templates)[number]];
    expect(templateSchema.safeParse({ ...template, category: null }).success).toBe(false);
    expect(
      templateSchema.safeParse({ ...template, id: BLANK_TEMPLATE_ID, category: "food" }).success,
    ).toBe(false);
  });

  it("have generated placeholders until their real photos are chosen (Q6, refined 26 Oct 2026)", () => {
    for (const { images } of templates) {
      for (const image of images) {
        if (image.source.startsWith("http")) continue;
        expect(image.source, image.file).toMatch(/^Generated for Webforge/);
        expect(image.licence, image.file).toBe("CC0-1.0");
      }
    }
  });
});

describe("the Blank template (2.15c)", () => {
  const blank = readTemplate(BLANK_TEMPLATE_ID);

  it("is Home, About and Contact, each a short skeleton, with no photos", () => {
    const { site } = blank.template;
    const pages = site.pageOrder.flatMap((id) => {
      const page = site.pages[id];
      return page?.kind === "page" ? [page] : [];
    });
    expect(pages.map((page) => [page.slug, page.title])).toEqual([
      ["home", "Home"],
      ["about", "About"],
      ["contact", "Contact"],
    ]);
    for (const page of pages) {
      expect(
        page.doc.content.map((node) => node.type),
        page.slug,
      ).toEqual(["Section"]);
    }
    expect(site.menu.items).toHaveLength(pages.length);
    expect(blank.images).toEqual([]);
    expect(blank.template.example).toBe(false);
  });
});

describe("readTemplate (2.14a)", () => {
  it("reads a shipped template from the package's folder by default", () => {
    expect(readTemplate("cafe").template.id).toBe("cafe");
  });

  it("refuses a folder whose template says it is another, or that has none", () => {
    const dir = mkdtempSync(join(tmpdir(), "webforge-templates-"));
    try {
      cpSync(join(TEMPLATES_DIR, "cafe"), join(dir, "other"), { recursive: true });
      expect(() => readTemplate("other", dir)).toThrow("says it is cafe");
      expect(() => readTemplate("missing", dir)).toThrow();
      // A template.json that fails its schema.
      writeFileSync(join(dir, "other", "template.json"), JSON.stringify({ id: "cafe" }));
      expect(() => readTemplate("other", dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
