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
import {
  DEFAULT_THEME,
  eachElement,
  type NodeDoc,
  type PageId,
  SITE_FORMAT_VERSION,
  type SiteDoc,
  siteDocSchema,
} from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { isIconName, sectionOverlay, siteLibrary, walkNodes } from "@webforge/site-components";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { overlayContrastIssue, THEME_PRESETS } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { businessDetailsSchema } from "../src/business.js";
import { readTemplate, readTemplates, TEMPLATES_DIR } from "../src/node.js";
import { insertRecipePage, PAGE_RECIPES, recipesFor } from "../src/recipes.js";
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

/** Every element of a template's site: its pages', Header's and Footer's. */
function elementsOf(site: SiteDoc): NodeDoc[] {
  const found: NodeDoc[] = [];
  eachElement(site, (node) => {
    found.push(node);
  });
  return found;
}

/** A text mark in rich text (2.25): an underline, a highlight or a theme colour. */
const TEXT_MARK = /<u>|<span class="(bg-secondary\/30|text-(primary|secondary|base-content))">/;

describe("the templates' styling (2.29, ST-8)", () => {
  it("each use the Appearance group, a hover effect, a text mark or a section background", () => {
    for (const { template } of templates) {
      const styled = elementsOf(template.site).filter(({ props }) =>
        Object.entries(props).some(
          ([name, value]) =>
            (name.startsWith("look") && value !== "default") ||
            (name === "hover" && value !== "none") ||
            name === "backgroundImage" ||
            (typeof value === "string" && TEXT_MARK.test(value)),
        ),
      );
      expect(styled.length, template.id).toBeGreaterThan(0);
    }
  });

  it("keep text readable over every section's background image, whatever the photo (2.26)", () => {
    for (const { template } of templates) {
      for (const { type, props } of elementsOf(template.site)) {
        const overlay = sectionOverlay(props);
        if (overlay === null) continue;
        // A banner draws its text in the Neutral colours: the check below assumes the overlay's.
        if (type === "CallToAction" && props.variant === "banner") {
          expect(overlay.color, `${template.id} ${type}`).toBe("neutral");
        }
        expect(overlayContrastIssue(template.site.theme, overlay), `${template.id} ${type}`).toBe(
          null,
        );
      }
    }
  });

  it("leave Site Check nothing to say about their colours, underlines or images (3.6)", () => {
    for (const { template, images } of templates) {
      // As a site made from it has it: its images in Media.
      const site = siteFromTemplate(template, images, {
        name: template.site.settings.general.name,
        theme: template.site.theme,
      });
      const report = checkSite({ site, catalogue: CATALOGUE }, "export");
      for (const rule of ["contrast", "underlinedText", "altText", "missingImages"]) {
        const result = report.results.find((each) => each.rule === rule);
        // The themes' own pairs are reported, not held to AA (2.13): only what the template wrote.
        const found = result?.findings.filter((finding) => finding.place.kind !== "theme");
        expect(found, `${template.id} ${rule}`).toEqual([]);
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

describe("siteFromTemplate with the person's business (QS-2, 3.11)", () => {
  const theme = DEFAULT_THEME;
  const business = {
    description: "Bread and cakes from our own oven",
    phone: "+44 1234 567890",
    email: "rosa@rosas.example",
    address: "1 High Street, Hightown",
    openingHours: [{ days: ["tue" as const], opens: "07:00", closes: "15:00" }],
  };
  /** Every string the site's copy has: its pages, Header and Footer, shared sections and menu. */
  const copyOf = (site: SiteDoc) =>
    JSON.stringify([site.pages, site.layout, site.sharedSections, site.menu]);

  it("puts the person's business in place of every template's sample business", () => {
    for (const { template, images } of templates) {
      const sample = template.site.settings;
      const site = siteFromTemplate(template, images, {
        name: "Rosa's Bakery",
        theme,
        business,
      });

      expect(siteDocSchema.parse(site), template.id).toEqual(site);
      expect(site.settings.general).toMatchObject({
        name: "Rosa's Bakery",
        description: business.description,
      });
      expect(site.settings.contact).toMatchObject({
        businessName: "Rosa's Bakery",
        phone: business.phone,
        email: business.email,
        address: business.address,
        openingHours: business.openingHours,
      });
      const copy = copyOf(site);
      for (const said of [
        sample.general.name,
        sample.contact.phone,
        sample.contact.email,
        sample.contact.address,
      ]) {
        if (said !== undefined) expect(copy, `${template.id}: ${said}`).not.toContain(said);
      }
    }
  });

  it("writes the name into the Footer's text and the pages' own, escaped in rich text", () => {
    const shop = readTemplate("shop");

    const site = siteFromTemplate(shop.template, shop.images, {
      name: "Rosa & Sons",
      theme,
      business: {},
    });

    const footer = JSON.stringify(site.layout.footer);
    expect(footer).toContain("Rosa & Sons · Handmade pots");
    expect(copyOf(site)).toContain("<p>Rosa &amp; Sons started on a kitchen table");
    expect(copyOf(site)).not.toContain("Fern &");
  });

  it("calls the person's number from the template's buttons, and keeps what they skipped", () => {
    const cafe = readTemplate("cafe");
    const sample = cafe.template.site.settings.contact;

    const called = siteFromTemplate(cafe.template, cafe.images, {
      name: "Rosa's",
      theme,
      business: { phone: business.phone },
    });
    const skipped = siteFromTemplate(cafe.template, cafe.images, {
      name: "Rosa's",
      theme,
      business: {},
    });

    expect(copyOf(called)).toContain(`"number":"${business.phone}"`);
    // Skipped: the template's placeholders stay, for Site Check to flag (QS-6).
    expect(skipped.settings.contact.phone).toBe(sample.phone);
    expect(skipped.settings.contact.openingHours).toEqual(sample.openingHours);
    expect(copyOf(skipped)).toContain(`"number":"${sample.phone}"`);
    expect(copyOf(skipped)).not.toContain("The Copper Kettle");
  });

  it("keeps the quick start's web address and business type in Site Settings (SEO-9)", () => {
    const cafe = readTemplate("cafe");

    const site = siteFromTemplate(cafe.template, cafe.images, {
      name: "Rosa's",
      theme,
      business: { webAddress: "https://rosas.example/", businessType: "food" },
    });

    expect(site.settings.address.url).toBe("https://rosas.example");
    expect(site.settings.search.businessType).toBe("food");
    expect(businessDetailsSchema.safeParse({ businessType: "garage" }).success).toBe(false);
  });

  it("leaves an example's sample business as it is, when no business is given (Try an example)", () => {
    const cafe = readTemplate("cafe");

    const site = siteFromTemplate(cafe.template, cafe.images, { name: "The Copper Kettle", theme });

    expect(copyOf(site)).toBe(copyOf(cafe.template.site));
    expect(site.settings.contact).toEqual(cafe.template.site.settings.contact);
  });

  it("binds each element whose text is the sample business's name, where the element can (QS-2)", () => {
    for (const { template } of templates) {
      const name = template.site.settings.general.name;
      eachElement(template.site, (node) => {
        const fields = CATALOGUE[node.type]?.fields ?? {};
        for (const [field, value] of Object.entries(node.props)) {
          const declared = fields[field];
          const bindable =
            declared !== undefined && "bindable" in declared ? declared.bindable : [];
          if (value !== name || !bindable?.includes("general.name")) continue;
          const bindings = node.props.bindings as Record<string, string> | undefined;
          expect(bindings?.[field], `${template.id} ${node.type}.${field}`).toBe("general.name");
        }
      });
    }
  });
});

describe("page recipes (QS-3, 3.11)", () => {
  it("use only the catalogue's components and icons, and link nowhere", () => {
    for (const recipe of PAGE_RECIPES) {
      // Throws for a component the catalogue doesn't have.
      walkNodes(recipe.content, siteLibrary, (node) => {
        if (typeof node.props.icon === "string") {
          expect(isIconName(node.props.icon), `${recipe.id} ${node.props.icon}`).toBe(true);
        }
        for (const value of Object.values(node.props)) {
          const kind = (value as { readonly kind?: unknown } | null)?.kind;
          expect(kind, `${recipe.id} ${node.type}`).toBeUndefined();
        }
      });
    }
  });

  it("give every business type at least two pages its template doesn't have", () => {
    for (const { template } of templates) {
      if (template.category === null) continue;
      const titles = Object.values(template.site.pages).map((page) => page.title);
      const recipes = recipesFor(template.category);
      expect(recipes.length, template.id).toBeGreaterThanOrEqual(2);
      for (const recipe of recipes) expect(titles, template.id).not.toContain(recipe.title);
    }
  });

  it("add a page to a site made from their type's template, which Site Check finds nothing in", () => {
    for (const { template, images } of templates) {
      if (template.category === null) continue;
      const site = siteFromTemplate(template, images, {
        name: template.site.settings.general.name,
        theme: template.site.theme,
      });
      const notFound = site.pageOrder.at(-1);
      for (const recipe of recipesFor(template.category)) {
        insertRecipePage(site, `recipe-${recipe.id}` as PageId, recipe);
      }

      expect(siteDocSchema.parse(site), template.id).toEqual(site);
      // Before the "Page not found" page, named, described and holding the recipe's sections.
      expect(site.pageOrder.at(-1), template.id).toBe(notFound);
      const [first] = recipesFor(template.category);
      const page = site.pages[`recipe-${first?.id}` as PageId];
      expect(page).toMatchObject({
        title: first?.title,
        settings: { description: first?.description },
        doc: { content: first?.content },
      });
      expect(page?.doc.content).not.toBe(first?.content);
      const report = checkSite({ site, catalogue: CATALOGUE }, "export");
      for (const rule of ["contrast", "underlinedText", "altText", "brokenLinks"]) {
        const result = report.results.find((each) => each.rule === rule);
        const found = result?.findings.filter((finding) => finding.place.kind !== "theme");
        expect(found, `${template.id} ${rule}`).toEqual([]);
      }
    }
  });
});

describe("siteFromTemplate with the Pages step's choices (QS-1, QS-3, 3.11)", () => {
  const trades = readTemplate("trades");
  const make = (pages: { leaveOut: string[]; recipes: string[] }) =>
    siteFromTemplate(trades.template, trades.images, {
      name: "Rosa's",
      theme: DEFAULT_THEME,
      pages,
    });

  it("leaves out the pages unticked, from the menu too, and their links go to the home page", () => {
    const site = make({ leaveOut: ["trades-contact"], recipes: [] });

    expect(siteDocSchema.parse(site)).toEqual(site);
    expect(site.pages["trades-contact" as PageId]).toBeUndefined();
    expect(site.pageOrder).not.toContain("trades-contact");
    expect(JSON.stringify(site.menu)).not.toContain("trades-contact");
    const copy = JSON.stringify([site.pages, site.layout, site.sharedSections]);
    expect(copy).not.toContain("trades-contact");
    expect(copy).toContain(`"pageId":"${site.homePageId}"`);
    const report = checkSite({ site, catalogue: CATALOGUE }, "export");
    expect(report.results.find((each) => each.rule === "brokenLinks")?.findings).toEqual([]);
  });

  it("adds a page for each recipe ticked, in that order, before 'Page not found'", () => {
    const site = make({ leaveOut: [], recipes: ["trades-faq", "trades-reviews"] });

    const titles = site.pageOrder.map((id) => site.pages[id]?.title);
    expect(titles.slice(-3)).toEqual(["FAQ", "Reviews", "Page not found"]);
    expect(site.pageOrder).toHaveLength(trades.template.site.pageOrder.length + 2);
  });

  it("keeps the home page and 'Page not found', and passes over ids it doesn't know", () => {
    const site = make({
      leaveOut: ["trades-home", "trades-not-found", "nowhere"],
      recipes: ["no-such-recipe"],
    });

    expect(site.pageOrder).toEqual(trades.template.site.pageOrder);
  });
});
