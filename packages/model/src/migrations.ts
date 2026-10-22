import { SITE_FORMAT_VERSION, type SiteDoc, siteDocSchema } from "./site-doc.js";

/**
 * Why a site document could not be loaded.
 * - `invalid`: not a site, or a site that fails the schema after migration.
 * - `newer-format`: saved by a newer Webforge; open it read-only and ask the user to update.
 */
export type SiteFormatErrorCode = "invalid" | "newer-format";

/** A site document that cannot be loaded. The message is for logs; show the user `code`. */
export class SiteFormatError extends Error {
  override readonly name = "SiteFormatError";
  readonly code: SiteFormatErrorCode;
  /** The document's format version, when it had a readable one. */
  readonly formatVersion: number | undefined;

  constructor(code: SiteFormatErrorCode, message: string, formatVersion?: number) {
    super(message);
    this.code = code;
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

/** Every node of a raw site: its pages' content, then the shared Header and Footer. */
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
  } catch {
    throw new SiteFormatError("invalid", "The site is not JSON", version);
  }
  while (version < options.currentVersion) {
    const step = options.migrations[version];
    if (step === undefined) {
      throw new SiteFormatError("invalid", `No migration from format ${version}`, version);
    }
    try {
      site = step(site);
    } catch {
      // A step meets data its version should never have had, e.g. a hand-edited file.
      throw new SiteFormatError("invalid", `Migration from format ${version} failed`, version);
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
