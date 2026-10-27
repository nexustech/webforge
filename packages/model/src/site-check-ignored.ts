import { z } from "zod";

/** The most findings Site Check remembers as ignored for a site. */
const IGNORED_MAX = 2000;

/**
 * What the person ignored in Site Check (3.6, F-CHK-1): each finding by its rule and key
 * (`brokenLinks:page-1/hero/page-2#`). Remembered with the site, as UI state like the editor mode:
 * never versioned or undone. The renderer, the main process and storage all check it here.
 */
export const siteCheckIgnoredSchema = z.array(z.string().min(1).max(500)).max(IGNORED_MAX);
