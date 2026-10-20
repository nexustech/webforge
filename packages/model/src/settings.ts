import { z } from "zod";
import { mediaIdSchema } from "./ids.js";
import { webUrlSchema } from "./link.js";

/** A BCP 47 language tag for `<html lang>`, e.g. `en` or `en-GB`. */
export const languageTagSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

/** Optional text: absent until the user types something. */
const text = (max: number) => z.string().max(max).optional();

/**
 * The site's public address, e.g. `https://www.example.com` (X3): https only, nothing after the
 * host, so sitemap and canonical URLs can be built from it.
 */
export const webAddressSchema = z
  .url({ protocol: /^https$/, hostname: z.regexes.domain })
  .regex(/^https:\/\/[^/?#@]+\/?$/, "Use only the address, without a page or folder");

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

const socialProfileSchema = z.strictObject({
  network: z.enum(SOCIAL_NETWORKS),
  url: webUrlSchema,
});

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

/** Days that share the same hours, e.g. Tuesday to Friday, 07:00–15:00. */
const openingHoursSchema = z.strictObject({
  days: z.array(z.enum(DAYS)).min(1),
  opens: time,
  closes: time,
});

/**
 * Where forms send submissions by default (B3, B6). None of these values is a secret: each one
 * ends up in the exported HTML.
 */
const formServiceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("formspree"), formId: z.string().regex(/^[A-Za-z0-9]{4,32}$/) }),
  z.strictObject({ kind: z.literal("web3forms"), accessKey: z.uuid() }),
  z.strictObject({ kind: z.literal("formsubmit"), email: z.email() }),
  z.strictObject({ kind: z.literal("netlify") }),
  z.strictObject({ kind: z.literal("custom"), url: webUrlSchema }),
]);

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
    host: z.string().regex(z.regexes.domain),
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
export const siteSettingsSchema = z.strictObject({
  general: z.strictObject({
    name: z.string().min(1).max(100),
    description: text(300),
    language: languageTagSchema,
    /** Source image for the favicon and app icons. */
    icon: mediaIdSchema.optional(),
  }),
  address: z.strictObject({ url: webAddressSchema.optional() }),
  social: z.strictObject({
    profiles: z.array(socialProfileSchema),
    /** Default `og:image`; pages can override it. */
    shareImage: mediaIdSchema.optional(),
    xHandle: z
      .string()
      .regex(/^@?[A-Za-z0-9_]{1,15}$/)
      .optional(),
  }),
  contact: z.strictObject({
    businessName: text(200),
    email: z.email().optional(),
    phone: z
      .string()
      .regex(/^\+?[0-9][0-9 ()-]{2,30}$/)
      .optional(),
    address: text(500),
    openingHours: z.array(openingHoursSchema),
    /** E.g. "Closed on bank holidays". */
    openingHoursNote: text(300),
  }),
  search: z.strictObject({ allowIndexing: z.boolean(), includeSitemap: z.boolean() }),
  analytics: z.strictObject({
    /** GA4 Measurement ID (B4). */
    measurementId: z
      .string()
      .regex(/^G-[A-Z0-9]{4,12}$/)
      .optional(),
    /** The consent banner; on by default once analytics is on (B7). */
    consentBanner: z.boolean(),
  }),
  forms: z.strictObject({ service: formServiceSchema.optional() }),
  publish: z.strictObject({ destinations: z.array(publishDestinationSchema) }),
  /** External addresses the user allowed in Custom HTML (C8). */
  allowedExternalUrls: z.array(webUrlSchema),
});

/** See {@link siteSettingsSchema}. */
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/** Settings of a new site: everything optional left empty, search engines allowed. */
export function defaultSiteSettings(name: string, language: string): SiteSettings {
  return {
    general: { name, language },
    address: {},
    social: { profiles: [] },
    contact: { openingHours: [] },
    search: { allowIndexing: true, includeSitemap: true },
    analytics: { consentBanner: true },
    forms: {},
    publish: { destinations: [] },
    allowedExternalUrls: [],
  };
}
