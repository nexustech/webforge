import { z } from "zod";
import { mediaIdSchema } from "./ids.js";
import { phoneNumberSchema, webUrlSchema } from "./link.js";

/** A BCP 47 language tag for `<html lang>`, e.g. `en` or `en-GB`. */
export const languageTagSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

/**
 * The longest language code the Site Settings field takes (`en-GB`, `zh-Hant-TW`): RFC 5646's
 * practical limit.
 */
export const LANGUAGE_TAG_MAX = 35;

/** The longest name the site can have (F-SET-1). */
export const SITE_NAME_MAX = 100;
/** The longest description the site can have for search results; as a page's (X3). */
export const SITE_DESCRIPTION_MAX = 300;
/** Contact details (F-SET-1): the business name, its postal address and a note on its hours. */
export const BUSINESS_NAME_MAX = 200;
export const POSTAL_ADDRESS_MAX = 500;
export const OPENING_HOURS_NOTE_MAX = 300;
/** The consent banner's own text (3.8), in place of the standard one. */
export const CONSENT_MESSAGE_MAX = 300;
/** An X handle: up to 15 letters, digits and underscores, with or without its `@`. */
export const X_HANDLE_MAX = 16;
/** A GA4 Measurement ID: `G-` and 4 to 12 capitals or digits (B4). */
export const MEASUREMENT_ID_MAX = 14;

/** Optional text: absent until the user types something. */
const text = (max: number) => z.string().max(max).optional();

/**
 * The site's public address, e.g. `https://www.example.com` (X3): https only, nothing after the
 * host, so sitemap and canonical URLs can be built from it.
 */
export const webAddressSchema = z
  .url({ protocol: /^https$/, hostname: z.regexes.domain })
  .regex(/^https:\/\/[^/?#@]+\/?$/, "Use only the address, without a page or folder");

/**
 * The kinds of business a site can be for (UX-29, QS-1): the templates' business types, which the
 * quick start asks first and Site Settings keeps for search engines (SEO-1, SEO-9).
 */
export const BUSINESS_TYPES = [
  "food",
  "beauty",
  "trades",
  "services",
  "creative",
  "shop",
  "personal",
] as const;

/** One of {@link BUSINESS_TYPES}. */
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Social networks with their own icon; anything else is `custom`. */
export const SOCIAL_NETWORKS = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "github",
  "custom",
] as const;

export const socialProfileSchema = z.strictObject({
  network: z.enum(SOCIAL_NETWORKS),
  url: webUrlSchema,
});

/** A link to the site's page on a social network, from Site Settings → Social & sharing. */
export type SocialProfile = z.infer<typeof socialProfileSchema>;

/** The days of the week, Monday first, as opening hours store them. */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** A day of the week, as opening hours store it. */
export type Day = (typeof DAYS)[number];

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

/** Days that share the same hours, e.g. Tuesday to Friday, 07:00–15:00. */
export const openingHoursSchema = z.strictObject({
  days: z.array(z.enum(DAYS)).min(1),
  opens: time,
  closes: time,
});

/** See {@link openingHoursSchema}. */
export type OpeningHours = z.infer<typeof openingHoursSchema>;

/**
 * Where forms send submissions by default (B3, B6). None of these values is a secret: each one
 * ends up in the exported HTML.
 */
export const formServiceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("formspree"), formId: z.string().regex(/^[A-Za-z0-9]{4,32}$/) }),
  z.strictObject({ kind: z.literal("web3forms"), accessKey: z.uuid() }),
  z.strictObject({ kind: z.literal("formsubmit"), email: z.email() }),
  z.strictObject({ kind: z.literal("netlify") }),
  z.strictObject({ kind: z.literal("custom"), url: webUrlSchema }),
]);

/** See {@link formServiceSchema}. */
export type FormService = z.infer<typeof formServiceSchema>;

/**
 * A place the site is published to (B1). Passwords and tokens are never stored in the site: they
 * live in the OS keychain under the destination's `id` (architecture §9).
 */
const publishDestinationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("ftp"),
    id: z.uuid(),
    name: z.string().min(1).max(100),
    protocol: z.enum(["sftp", "ftps", "ftp"]),
    /** A host name, or an IP address as many hosting providers give it. */
    host: z.union([z.string().regex(z.regexes.domain), z.ipv4(), z.ipv6()]),
    port: z.int().min(1).max(65_535),
    username: z.string().min(1).max(200),
    remotePath: z.string().max(500),
  }),
  z.strictObject({
    kind: z.literal("netlify"),
    id: z.uuid(),
    name: z.string().min(1).max(100),
    /** Netlify's id of the site, once the first publish has created or chosen it. */
    siteId: z
      .string()
      .regex(/^[0-9a-f-]{36}$/)
      .optional(),
  }),
]);

/**
 * Site Settings (X3, F-SET-1), grouped like the dialog's sections. Components can show these values
 * through bindings, so a phone number typed once appears everywhere.
 */
/** A GA4 Measurement ID (B4): `G-` and 4 to 12 capitals or digits. */
export const measurementIdSchema = z
  .string()
  .regex(new RegExp(`^G-[A-Z0-9]{4,${MEASUREMENT_ID_MAX - 2}}$`));

/**
 * A search engine's site verification code (3.15, SEO-8): what Google's `google-site-verification`
 * or Bing's `msvalidate.01` tag holds as its `content`.
 */
export const verificationCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);

/**
 * The verification code in what the person pasted (3.15, SEO-8): the code itself, or the whole
 * `<meta … content="…">` tag the console shows, from which its `content` is taken.
 */
export function verificationCodeOf(pasted: string): string {
  const content = /content\s*=\s*["']([^"']*)["']/i.exec(pasted)?.[1];
  return (content ?? pasted).trim();
}

export const siteSettingsSchema = z.strictObject({
  general: z.strictObject({
    name: z.string().min(1).max(SITE_NAME_MAX),
    description: text(SITE_DESCRIPTION_MAX),
    language: languageTagSchema,
    /** Source image for the favicon and app icons. */
    icon: mediaIdSchema.optional(),
    /**
     * A back-to-top button on every page (F-CM-9, 2.9), shown once the visitor has scrolled down;
     * a page can leave it out (`hideBackToTop`). Off when absent, as in files from before it.
     */
    backToTop: z.boolean().optional(),
    /**
     * The kind of business the site is for (SEO-9, 3.11b): the quick start's first answer, which
     * search engines' structured data starts from (SEO-1, 3.15). Unknown when absent, so no new
     * format.
     */
    businessType: z.enum(BUSINESS_TYPES).optional(),
  }),
  address: z.strictObject({ url: webAddressSchema.optional() }),
  social: z.strictObject({
    profiles: z.array(socialProfileSchema),
    /** Default `og:image`; pages can override it. */
    shareImage: mediaIdSchema.optional(),
    xHandle: z
      .string()
      .regex(new RegExp(`^@?[A-Za-z0-9_]{1,${X_HANDLE_MAX - 1}}$`))
      .optional(),
  }),
  contact: z.strictObject({
    businessName: text(BUSINESS_NAME_MAX),
    email: z.email().optional(),
    phone: phoneNumberSchema.optional(),
    address: text(POSTAL_ADDRESS_MAX),
    openingHours: z.array(openingHoursSchema),
    /** E.g. "Closed on bank holidays". */
    openingHoursNote: text(OPENING_HOURS_NOTE_MAX),
  }),
  search: z.strictObject({
    allowIndexing: z.boolean(),
    includeSitemap: z.boolean(),
    /**
     * *Help AI tools read your site* (F-EX-5, 3.5): `llms.txt` and a Markdown copy of each page in
     * the export. On for new sites; off when absent, as in sites from before it (ADR 0012: an
     * optional field whose absence keeps the old meaning needs no new format).
     */
    readableByAi: z.boolean().optional(),
    /**
     * The codes Google Search Console and Bing Webmaster Tools give to prove the site is the
     * owner's (3.15, SEO-8), written as their `<meta>` tags: no account or network here. None when
     * absent (ADR 0012).
     */
    verification: z
      .strictObject({
        google: verificationCodeSchema.optional(),
        bing: verificationCodeSchema.optional(),
      })
      .optional(),
  }),
  analytics: z.strictObject({
    /** GA4 Measurement ID (B4). */
    measurementId: measurementIdSchema.optional(),
    /** The consent banner; on by default once analytics is on (B7). */
    consentBanner: z.boolean(),
    /** The banner's own text, in place of the standard one (3.8); none for the standard text. */
    consentMessage: text(CONSENT_MESSAGE_MAX),
  }),
  forms: z.strictObject({ service: formServiceSchema.optional() }),
  publish: z.strictObject({ destinations: z.array(publishDestinationSchema) }),
  /** External addresses the user allowed in Custom HTML (C8). */
  allowedExternalUrls: z.array(webUrlSchema),
});

/** See {@link siteSettingsSchema}. */
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/**
 * Settings of a new site: everything optional left empty, search engines allowed, and AI tools
 * helped to read it (F-EX-5).
 */
export function defaultSiteSettings(name: string, language: string): SiteSettings {
  return {
    general: { name, language },
    address: {},
    social: { profiles: [] },
    contact: { openingHours: [] },
    search: { allowIndexing: true, includeSitemap: true, readableByAi: true },
    analytics: { consentBanner: true },
    forms: {},
    publish: { destinations: [] },
    allowedExternalUrls: [],
  };
}
