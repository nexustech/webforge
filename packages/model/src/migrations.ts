import { WebforgeError } from "@webforge/errors";
import { FORMAT_5_DAISYUI_THEMES } from "./format-5-themes.js";
import { SITE_FORMAT_VERSION, type SiteDoc, siteDocSchema } from "./site-doc.js";

/**
 * Why a site document could not be loaded.
 * - `invalid`: not a site, or a site that fails the schema after migration.
 * - `newer-format`: saved by a newer Webforge; open it read-only and ask the user to update.
 */
export type SiteFormatErrorCode = "invalid" | "newer-format";

/** A site document that cannot be loaded. The message is for developers; `code` says what. */
export class SiteFormatError extends WebforgeError<SiteFormatErrorCode> {
  override readonly name = "SiteFormatError";
  /** The document's format version, when it had a readable one. */
  readonly formatVersion: number | undefined;

  constructor(
    code: SiteFormatErrorCode,
    message: string,
    formatVersion?: number,
    options?: ErrorOptions,
  ) {
    super(
      code,
      code === "invalid" ? "site.openFailed.damaged" : "site.openFailed.newer",
      message,
      options,
    );
    this.formatVersion = formatVersion;
  }
}

/** A site document as JSON, before it is validated. */
export type RawSite = { readonly formatVersion: number } & Record<string, unknown>;

/**
 * Turns a site of format version `n` into version `n + 1`. Migrations are pure: they get a copy
 * they may change and return the new document, with `formatVersion` raised by one.
 */
export type SiteMigration = (site: RawSite) => RawSite;

/**
 * The migration chain (06, F2), keyed by the version each step migrates *from*: `MIGRATIONS[1]`
 * turns version 1 into version 2. Every bump of {@link SITE_FORMAT_VERSION} adds one step and a
 * fixture in `test/fixtures/v<n>/`; fixtures are never deleted, so every old site keeps opening.
 */
export const MIGRATIONS: Readonly<Record<number, SiteMigration>> = {
  1: heroImageValues,
  2: sharedSections,
  3: uniqueSharedSectionNames,
  4: themeTokens,
  5: sectionPaddingBoxes,
  6: themeStyleTokens,
  7: ownThemes,
  8: componentLooks,
  9: accentFonts,
};

type RawNode = { type: string; props: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRawNode = (value: unknown): value is RawNode =>
  isRecord(value) && typeof value.type === "string" && isRecord(value.props);

/** Calls `visit` for every node in `nodes` and in the slot arrays of their props, depth first. */
function walkNodes(nodes: unknown, visit: (node: RawNode) => void): void {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!isRawNode(node)) continue;
    visit(node);
    for (const value of Object.values(node.props)) {
      if (Array.isArray(value) && value.some(isRawNode)) walkNodes(value, visit);
    }
  }
}

/**
 * Every node of a raw site: its pages' content, the shared Header and Footer, then the shared
 * sections' (from format 3).
 */
function walkSite(site: RawSite, visit: (node: RawNode) => void): void {
  if (isRecord(site.pages)) {
    for (const page of Object.values(site.pages)) {
      if (isRecord(page) && isRecord(page.doc)) walkNodes(page.doc.content, visit);
    }
  }
  if (isRecord(site.layout)) {
    walkNodes(site.layout.header, visit);
    walkNodes(site.layout.footer, visit);
  }
  if (isRecord(site.sharedSections)) {
    for (const entry of Object.values(site.sharedSections)) {
      if (isRecord(entry)) walkNodes([entry.section], visit);
    }
  }
}

/**
 * Format 1 → 2 (1.16): a Hero's image becomes one image value, `{ mediaId, alt? }`, with the alt
 * text for that placement, instead of a media id plus a separate `imageDescription`. An empty id
 * means no image; an empty description means the image's own alt text from Media applies. Heroes
 * that already have the new shape keep it.
 */
function heroImageValues(site: RawSite): RawSite {
  walkSite(site, (node) => {
    if (node.type !== "Hero") return;
    const { image, imageDescription } = node.props;
    const alt =
      typeof imageDescription === "string" && imageDescription !== ""
        ? imageDescription
        : undefined;
    if (typeof image === "string") {
      if (image === "") {
        delete node.props.image;
      } else {
        node.props.image = { mediaId: image, ...(alt === undefined ? {} : { alt }) };
      }
    } else if (isRecord(image) && alt !== undefined && image.alt === undefined) {
      image.alt = alt;
    }
    delete node.props.imageDescription;
  });
  return { ...site, formatVersion: 2 };
}

/**
 * Format 2 → 3 (1.29): the site gets its shared sections (F-ED-23), none yet. A site that already
 * has them keeps them.
 */
function sharedSections(site: RawSite): RawSite {
  return {
    ...site,
    sharedSections: isRecord(site.sharedSections) ? site.sharedSections : {},
    formatVersion: 3,
  };
}

/** The longest shared section name (`SHARED_SECTION_NAME_MAX`, kept here as it was in format 4). */
const SHARED_NAME_MAX = 100;

/**
 * Format 3 → 4 (1.29): no two shared sections share a name, ignoring capitals and spaces around it
 * (F-ED-23). A later one with a name already taken gets the lowest free number after it ("Opening
 * hours 2"), shortened to fit if needed; the first, in the file's order, keeps its name.
 */
function uniqueSharedSectionNames(site: RawSite): RawSite {
  if (isRecord(site.sharedSections)) {
    const taken = new Set<string>();
    for (const entry of Object.values(site.sharedSections)) {
      if (!isRecord(entry) || typeof entry.name !== "string") continue;
      const base = entry.name.trim();
      let name = base;
      for (let number = 2; taken.has(name.toLowerCase()); number++) {
        const end = ` ${number}`;
        name = `${base.slice(0, SHARED_NAME_MAX - end.length).trimEnd()}${end}`;
      }
      if (name !== base) entry.name = name;
      taken.add(name.toLowerCase());
    }
  }
  return { ...site, formatVersion: 4 };
}

/**
 * The tokens format 5 gives every migrated site besides its daisyUI theme's own (fonts, spacing,
 * the type scale, links, buttons, shadows): the "light" preset's as they were in format 5.
 */
const FORMAT_5_DEFAULTS = {
  fonts: {
    heading: { family: "Inter", fallback: "sans-serif" },
    body: { family: "Inter", fallback: "sans-serif" },
  },
  spacing: "normal",
  typeScale: {
    h1: { size: "5xl", weight: 700, leading: "tight" },
    h2: { size: "3xl", weight: 700, leading: "tight" },
    h3: { size: "xl", weight: 600, leading: "tight" },
    h4: { size: "lg", weight: 600, leading: "normal" },
    h5: { size: "base", weight: 600, leading: "normal" },
    h6: { size: "sm", weight: 600, leading: "normal" },
    body: { size: "lg", weight: 400, leading: "relaxed" },
    small: { size: "sm", weight: 400, leading: "normal" },
  },
  links: { underline: "always" },
  buttons: { shape: "rounded", size: "m", style: "filled" },
  shadow: "soft",
};

/**
 * Format 4 → 5 (2.1): the theme is the site's design tokens instead of a daisyUI theme's name. A
 * site whose theme was one of daisyUI's built-in themes gets that theme's colours, corners, border,
 * depth and noise (`FORMAT_5_DAISYUI_THEMES`), with its name as their preset, so it looks as
 * before; any other name, which named no theme, becomes the light one. It has no colours for inverse
 * sections.
 */
function themeTokens(site: RawSite): RawSite {
  const name = isRecord(site.theme) ? site.theme.name : undefined;
  const preset =
    typeof name === "string" && Object.hasOwn(FORMAT_5_DAISYUI_THEMES, name) ? name : "light";
  const theme = { preset, ...FORMAT_5_DAISYUI_THEMES[preset], ...FORMAT_5_DEFAULTS };
  return { ...site, theme: JSON.parse(JSON.stringify(theme)), formatVersion: 5 };
}

/** The spacing token each of a Section's format 5 padding sizes gives its top and bottom. */
const FORMAT_5_PADDING = new Map([
  ["small", "s"],
  ["medium", "m"],
  ["large", "l"],
]);

const DEVICES = ["desktop", "tablet", "mobile"] as const;

/**
 * Format 5 → 6 (R14): a Section's padding is a box, a spacing token per side, instead of one size
 * ("small", "medium" or "large") for its top and bottom. 1.32 made it a box without bumping the
 * format, and read the old sizes when it drew a Section; this step moves that into the chain
 * (ADR 0012). Per device too; any other value is left for validation.
 */
function sectionPaddingBoxes(site: RawSite): RawSite {
  const box = (value: unknown): unknown => {
    const token = typeof value === "string" ? FORMAT_5_PADDING.get(value) : undefined;
    return token === undefined ? value : { top: token, bottom: token };
  };
  walkSite(site, (node) => {
    if (node.type !== "Section" || !Object.hasOwn(node.props, "padding")) return;
    const { padding } = node.props;
    if (isRecord(padding) && isRecord(padding.$responsive)) {
      const devices = padding.$responsive;
      for (const device of DEVICES) {
        if (Object.hasOwn(devices, device)) devices[device] = box(devices[device]);
      }
    } else {
      node.props.padding = box(padding);
    }
  });
  return { ...site, formatVersion: 6 };
}

/** The style tokens format 7 gives every theme: the look every site had in format 6. */
const FORMAT_7_DEFAULTS = {
  headings: { case: "normal", tracking: "normal" },
  cards: { style: "flat" },
  images: { corners: "rounded" },
  sections: { rhythm: "plain" },
};

/**
 * Format 6 → 7 (2.13d, PH2-15): the theme has style tokens for headings' case and letter spacing,
 * cards, photos' corners and the sections' rhythm, each as every site looked in format 6. A theme
 * that isn't a record is left for validation.
 */
function themeStyleTokens(site: RawSite): RawSite {
  const theme = isRecord(site.theme)
    ? { ...JSON.parse(JSON.stringify(FORMAT_7_DEFAULTS)), ...site.theme }
    : site.theme;
  return { ...site, theme, formatVersion: 7 };
}

/**
 * Format 7 → 8 (2.23, PH2-17): a theme may be the person's own, with an id and a name (`own`).
 * Every older site's theme is a built-in one, as it was, so nothing changes but the version: a
 * build that reads only format 7 refuses an own theme as from a newer version, not as broken.
 */
function ownThemes(site: RawSite): RawSite {
  return { ...site, formatVersion: 8 };
}

/**
 * Format 8 → 9 (3.12, CT-1): a theme may hold a look for each kind of section and element
 * (`looks`). No older site's theme has one, so nothing changes but the version: a build that reads
 * only format 8 refuses a site with looks as from a newer version, rather than drop them.
 */
function componentLooks(site: RawSite): RawSite {
  return { ...site, formatVersion: 9 };
}

/**
 * Format 9 → 10 (3.22, PF-5): the theme has a third font, the accent, beside headings' and body
 * text's, and a look may set an element's font (`lookFont`). Every older theme's accent is its
 * headings' font, which nothing uses yet, so every site looks as it did. A theme that isn't a
 * record, or has no fonts, is left for validation.
 */
function accentFonts(site: RawSite): RawSite {
  const theme = site.theme;
  if (
    !isRecord(theme) ||
    !isRecord(theme.fonts) ||
    theme.fonts.accent !== undefined ||
    !isRecord(theme.fonts.heading)
  ) {
    return { ...site, formatVersion: 10 };
  }
  const fonts = { ...theme.fonts, accent: structuredClone(theme.fonts.heading) };
  return { ...site, theme: { ...theme, fonts }, formatVersion: 10 };
}

/** Options of {@link migrateSiteWith}; the defaults are this build's chain and version. */
export type MigrateOptions = {
  readonly migrations: Readonly<Record<number, SiteMigration>>;
  readonly currentVersion: number;
};

function readVersion(raw: unknown): number {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SiteFormatError("invalid", "The site is not an object");
  }
  const version = (raw as { formatVersion?: unknown }).formatVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new SiteFormatError("invalid", "The site has no valid format version");
  }
  return version;
}

/**
 * Brings a site document of any older format version up to `currentVersion` by running the chain
 * step by step, without validating the result. Throws {@link SiteFormatError} for documents that
 * aren't sites, are newer than this build, or have a gap in the chain.
 */
export function migrateSiteWith(raw: unknown, options: MigrateOptions): RawSite {
  let version = readVersion(raw);
  if (version > options.currentVersion) {
    throw new SiteFormatError(
      "newer-format",
      `The site has format ${version}; this build reads up to ${options.currentVersion}`,
      version,
    );
  }
  if (version === options.currentVersion) {
    return raw as RawSite;
  }
  let site: RawSite;
  try {
    // A deep copy (site documents are JSON), so migrations may change what they get without
    // touching the caller's data.
    site = JSON.parse(JSON.stringify(raw)) as RawSite;
  } catch (cause) {
    throw new SiteFormatError("invalid", "The site is not JSON", version, { cause });
  }
  while (version < options.currentVersion) {
    const step = options.migrations[version];
    if (step === undefined) {
      throw new SiteFormatError("invalid", `No migration from format ${version}`, version);
    }
    try {
      site = step(site);
    } catch (cause) {
      // A step meets data its version should never have had, e.g. a hand-edited file. The cause
      // tells that apart from a bug in the step, in the local crash report.
      throw new SiteFormatError("invalid", `Migration from format ${version} failed`, version, {
        cause,
      });
    }
    if (site.formatVersion !== version + 1) {
      throw new SiteFormatError(
        "invalid",
        `Migration from format ${version} did not bump it`,
        version,
      );
    }
    version = site.formatVersion;
  }
  return site;
}

/**
 * Loads a site document from outside (a `.wforge` file, a version, a ZIP import): migrates it to
 * {@link SITE_FORMAT_VERSION}, then validates it with {@link siteDocSchema}. Old versions are
 * migrated lazily, when they are opened, previewed or restored.
 */
export function migrateSite(raw: unknown): SiteDoc {
  try {
    return migrateAndValidate(raw);
  } catch (error) {
    // Anything else a malformed file can cause (a RangeError from code that recurses, R14) is
    // an invalid site too, never a raw error. The cause stays for the local crash report: a bug
    // in this build reads differently from a bad file there.
    if (error instanceof SiteFormatError) throw error;
    throw new SiteFormatError("invalid", "The site could not be read", undefined, {
      cause: error,
    });
  }
}

function migrateAndValidate(raw: unknown): SiteDoc {
  const migrated = migrateSiteWith(raw, {
    migrations: MIGRATIONS,
    currentVersion: SITE_FORMAT_VERSION,
  });
  const result = siteDocSchema.safeParse(migrated);
  if (!result.success) {
    // Issue paths and codes only: messages can quote slugs or names, which are the user's content.
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}: ${issue.code}`)
      .join("; ");
    // No `cause`: the zod error's messages would reach the logs with it.
    // migrateSiteWith has checked that `raw` has a valid format version.
    const version = (raw as RawSite).formatVersion;
    throw new SiteFormatError("invalid", `The site fails validation: ${issues}`, version);
  }
  return result.data;
}
