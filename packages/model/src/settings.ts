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

/** The `<meta name>` each search engine's verification tag has (3.15, SEO-8). */
export const VERIFICATION_TAGS = {
  google: "google-site-verification",
  bing: "msvalidate.01",
} as const;

/**
 * The verification code in what the person pasted for search engine `engine` (3.15, SEO-8): the
 * code itself, or the whole `<meta … content="…">` tag the console shows, from which its `content`
 * is taken when its `name` is that engine's. Another engine's tag is left as pasted, which isn't a
 * code, so the field says so rather than save it under the wrong name.
 */
export function verificationCodeOf(pasted: string, engine: keyof typeof VERIFICATION_TAGS): string {
  const tag = /<meta\b[^>]*>/i.exec(pasted)?.[0];
  if (tag === undefined) return pasted.trim();
  const attribute = (name: string) =>
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  const content = attribute("content");
  return attribute("name")?.toLowerCase() === VERIFICATION_TAGS[engine] && content !== undefined
    ? content.trim()
    : pasted.trim();
}

/**
 * The kinds of business a site can be for (3.11's quick start, QS-1; 3.15's structured data,
 * SEO-1): the New Site dialog's categories, which a template's category is one of.
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

/**
 * The schema.org types a business of each type can be marked up as (3.15, SEO-1), the first its
 * default. A personal site is no business: it has none, and is marked up as a website only.
 */
export const BUSINESS_KINDS = {
  food: ["FoodEstablishment", "CafeOrCoffeeShop", "Restaurant", "Bakery", "BarOrPub"],
  beauty: ["HealthAndBeautyBusiness", "HairSalon", "BeautySalon", "NailSalon", "DaySpa"],
  trades: [
    "HomeAndConstructionBusiness",
    "Plumber",
    "Electrician",
    "GeneralContractor",
    "HousePainter",
    "Locksmith",
    "RoofingContractor",
  ],
  services: ["ProfessionalService", "AccountingService", "LegalService", "FinancialService"],
  creative: ["LocalBusiness"],
  shop: ["Store", "ClothingStore", "BookStore", "Florist", "GiftShop", "HomeGoodsStore"],
  personal: [],
} as const satisfies Readonly<Record<BusinessType, readonly string[]>>;

/** Every schema.org type in {@link BUSINESS_KINDS}. */
const ALL_BUSINESS_KINDS = Object.values(BUSINESS_KINDS).flat() as [string, ...string[]];

/** One of {@link BUSINESS_KINDS}' types. */
export type BusinessKind = (typeof BUSINESS_KINDS)[BusinessType][number];

/** The longest price range a business may give (Google's `priceRange`): "££", "£10–£30". */
export const PRICE_RANGE_MAX = 30;

export const siteSettingsSchema = z.strictObject({
  general: z.strictObject({
    name: z.string().min(1).max(SITE_NAME_MAX),
    description: text(SITE_DESCRIPTION_MAX),
    language: languageTagSchema,
    /** Source image for the favicon and app icons. */
    icon: mediaIdSchema.optional(),
    /**
     * What kind of business it is (3.11, QS-1; 3.15, SEO-1): the quick start's choice, which
     * picks the structured data's type. Unknown when absent (ADR 0012).
     */
    businessType: z.enum(BUSINESS_TYPES).optional(),
    /**
     * Its schema.org type within {@link BUSINESS_KINDS}' list for its type (3.15, SEO-1); the
     * type's first when absent, or when it isn't one of that type's.
     */
    businessKind: z.enum(ALL_BUSINESS_KINDS).optional(),
    /**
     * A back-to-top button on every page (F-CM-9, 2.9), shown once the visitor has scrolled down;
     * a page can leave it out (`hideBackToTop`). Off when absent, as in files from before it.
     */
    backToTop: z.boolean().optional(),
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
    /** How much it costs, as people say it (3.15, SEO-1): "££", "£10–£30". */
    priceRange: text(PRICE_RANGE_MAX),
    /** Where it is on a map (3.15, SEO-1), for the structured data; typed or from a map link. */
    geo: z
      .strictObject({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
  }),
  search: z.strictObject({
    allowIndexing: z.boolean(),
    includeSitemap: z.boolean(),
    /**
     * *Help AI tools read your site* (F-EX-5, 3.5): `llms.txt` and a Markdown copy of each page in
     * the export. Off unless the person turns it on (3.15, SEO-12): search engines don't read
     * them. Off when absent (ADR 0012: an optional field whose absence keeps the old meaning
     * needs no new format); a site made since 3.5 keeps the value it stored.
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
    search: { allowIndexing: true, includeSitemap: true, readableByAi: false },
    analytics: { consentBanner: true },
    forms: {},
    publish: { destinations: [] },
    allowedExternalUrls: [],
  };
}
