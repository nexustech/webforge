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
export const MIGRATIONS: Readonly<Record<number, SiteMigration>> = {};

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
