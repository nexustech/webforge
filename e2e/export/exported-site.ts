import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Where the setup project exports the fixture site for the browser projects to open. CI sets
 * WEBFORGE_EXPORTED_SITE_DIR: the E2E job exports there and uploads it, and the Firefox and WebKit
 * job runs the browser projects on the downloaded copy, in Playwright's container (no setup).
 */
export const EXPORTED_SITE_DIR =
  process.env.WEBFORGE_EXPORTED_SITE_DIR ?? join(tmpdir(), "webforge-e2e-exported-site");

/** The `file://` URL of a page of the exported fixture site. */
export function exportedPageUrl(page: string): string {
  return pathToFileURL(join(EXPORTED_SITE_DIR, page)).href;
}

/**
 * Where the setup exports the fixture site a second time, in a theme of its own (#423), inside the
 * fixture's folder so CI uploads it with it.
 */
export const THEMED_SITE_DIR = join(EXPORTED_SITE_DIR, "themed");

/** The `file://` URL of a page of the themed export. */
export function themedPageUrl(page: string): string {
  return pathToFileURL(join(THEMED_SITE_DIR, page)).href;
}

/**
 * Where the setup exports a one-page site with Google Analytics and the consent banner turned off
 * (#650), inside the fixture's folder so CI uploads it with it.
 */
export const NO_BANNER_SITE_DIR = join(EXPORTED_SITE_DIR, "no-banner");

/**
 * Where the setup exports the fixture's home and About pages with an Announcement bar above the
 * Header (6.4), inside the fixture's folder so CI uploads it with it.
 */
export const ANNOUNCEMENT_SITE_DIR = join(EXPORTED_SITE_DIR, "announcement");

/**
 * Where the setup exports the fixture's home and About pages with the Header joined to each page's
 * first section (HH-1), inside the fixture's folder so CI uploads it with it.
 */
export const JOINED_SITE_DIR = join(EXPORTED_SITE_DIR, "joined");

/**
 * Where the setup exports the fixture's home and About pages with Contact buttons after the Footer
 * and the consent banner on (6.16d), inside the fixture's folder so CI uploads it with it.
 */
export const CONTACT_BUTTONS_SITE_DIR = join(EXPORTED_SITE_DIR, "contact-buttons");

/**
 * Where the setup exports a home page of Heroes with their text over a picture, each with its own
 * Overlay (HH-3), inside the fixture's folder so CI uploads it with it.
 */
export const HERO_OVERLAY_SITE_DIR = join(EXPORTED_SITE_DIR, "hero-overlay");

/**
 * Where the setup exports a home page opening with a Whole screen Hero (HH-4), under a Header with
 * its own band (`own/`) and joined to it (`joined/`), inside the fixture's folder so CI uploads it.
 */
export const HERO_HEIGHT_SITE_DIR = join(EXPORTED_SITE_DIR, "hero-height");

/**
 * Where the setup exports the fixture's pages with a Header that hides on the way down (HH-7),
 * inside the fixture's folder so CI uploads it with it.
 */
export const HIDING_HEADER_SITE_DIR = join(EXPORTED_SITE_DIR, "hiding-header");

/**
 * Where the setup exports the fixture's home and About pages with a logo and a logo for dark
 * backgrounds, the Header joined to each page's first section and staying at the top (HH-2),
 * inside the fixture's folder so CI uploads it with it.
 */
export const LOGO_ON_DARK_SITE_DIR = join(EXPORTED_SITE_DIR, "logo-on-dark");

/**
 * Where the setup exports the fixture's pages with a Blog's post (6.10a), inside the fixture's
 * folder so CI uploads it with it.
 */
export const BLOG_SITE_DIR = join(EXPORTED_SITE_DIR, "blog");

/**
 * Where the setup exports every template, one folder each by its id (3.10), inside the fixture's
 * folder so CI uploads them with it.
 */
export const TEMPLATES_DIR = join(EXPORTED_SITE_DIR, "templates");

/**
 * Whether the templates are exported and checked (3.10): always, but in CI only when what they're
 * made from can have changed (`WEBFORGE_EXPORT_TEMPLATES=0` otherwise, from `changes`' output).
 */
export const CHECK_TEMPLATES = process.env.WEBFORGE_EXPORT_TEMPLATES !== "0";
