import { describe, expect, it } from "vitest";
import v1Site from "../test/fixtures/v1/site.json" with { type: "json" };
import {
  MIGRATIONS,
  migrateSite,
  migrateSiteWith,
  type RawSite,
  SiteFormatError,
  type SiteMigration,
} from "./migrations.js";
import { createSite, SITE_FORMAT_VERSION } from "./site-doc.js";

function formatError(run: () => unknown): SiteFormatError {
  try {
    run();
  } catch (error) {
    if (error instanceof SiteFormatError) return error;
    throw error;
  }
  throw new Error("expected a SiteFormatError");
}

describe("migrateSite", () => {
  it("opens the format 1 fixture unchanged", () => {
    // Fixtures of released formats are never deleted: every old site must keep opening.
    const site = migrateSite(v1Site);

    expect(site).toEqual(v1Site);
    expect(site.formatVersion).toBe(SITE_FORMAT_VERSION);
  });

  it("opens a new site after a JSON round trip", () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });

    expect(migrateSite(JSON.parse(JSON.stringify(site)))).toEqual(site);
  });

  it("has a migration step for every older format", () => {
    for (let version = 1; version < SITE_FORMAT_VERSION; version++) {
      expect(MIGRATIONS[version]).toBeTypeOf("function");
    }
  });

  it("reports a newer format, so the site can open read-only", () => {
    const error = formatError(() => migrateSite({ ...v1Site, formatVersion: 99 }));

    expect(error.code).toBe("newer-format");
    expect(error.formatVersion).toBe(99);
  });

  it.each([null, [], "site", 1, {}, { formatVersion: 0 }, { formatVersion: 1.5 }])(
    "rejects %j as not a site",
    (raw) => {
      expect(formatError(() => migrateSite(raw)).code).toBe("invalid");
    },
  );

  it("rejects a site that fails validation, naming fields but none of the site's text", () => {
    const broken = { ...v1Site, pageOrder: ["home000000000000"] };
    broken.settings = { ...v1Site.settings, general: { ...v1Site.settings.general, name: "" } };

    const error = formatError(() => migrateSite(broken));

    expect(error.code).toBe("invalid");
    expect(error.formatVersion).toBe(1);
    expect(error.message).toContain("settings.general.name");
    expect(error.message).toContain("pageOrder");
    expect(error.message).not.toContain("Rosa");
    expect(error.cause).toBeUndefined();
  });
});

describe("migrateSiteWith", () => {
  // A pretend history: format 1 had `theme` as a string, format 2 renamed `title` to `name`.
  const migrations: Record<number, SiteMigration> = {
    1: (site) => ({ ...site, formatVersion: 2, theme: { name: site.theme } }),
    2: ({ title, ...site }) => ({ ...site, formatVersion: 3, name: title }),
  };

  it("runs every step from the document's version to the current one, in order", () => {
    const migrated = migrateSiteWith(
      { formatVersion: 1, theme: "cupcake", title: "Rosa" },
      { migrations, currentVersion: 3 },
    );

    expect(migrated).toEqual({ formatVersion: 3, theme: { name: "cupcake" }, name: "Rosa" });
  });

  it("starts in the middle of the chain for newer documents", () => {
    const migrated = migrateSiteWith(
      { formatVersion: 2, theme: { name: "light" }, title: "Rosa" },
      { migrations, currentVersion: 3 },
    );

    expect(migrated).toEqual({ formatVersion: 3, theme: { name: "light" }, name: "Rosa" });
  });

  it("never changes the caller's document", () => {
    const raw = { formatVersion: 1, theme: "cupcake", nested: { title: "x" } };
    const mutating: SiteMigration = (site: RawSite) => {
      (site.nested as { title: string }).title = "changed";
      return { ...site, formatVersion: 2 };
    };

    migrateSiteWith(raw, { migrations: { 1: mutating }, currentVersion: 2 });

    expect(raw.nested.title).toBe("x");
  });

  it("fails on a gap in the chain or a step that doesn't bump the version", () => {
    expect(
      formatError(() =>
        migrateSiteWith({ formatVersion: 1 }, { migrations: {}, currentVersion: 2 }),
      ).message,
    ).toBe("No migration from format 1");
    const stuck: SiteMigration = (site) => site;
    expect(
      formatError(() =>
        migrateSiteWith({ formatVersion: 1 }, { migrations: { 1: stuck }, currentVersion: 2 }),
      ).message,
    ).toBe("Migration from format 1 did not bump it");
    const failing: SiteMigration = () => {
      throw new TypeError("site.pages is undefined");
    };
    expect(
      formatError(() =>
        migrateSiteWith({ formatVersion: 1 }, { migrations: { 1: failing }, currentVersion: 2 }),
      ).message,
    ).toBe("Migration from format 1 failed");
  });
});
