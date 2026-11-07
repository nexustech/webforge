import { t } from "@webforge/i18n";
import { type SiteDoc, type SiteSettings, siteSettingsSchema } from "@webforge/model";
import { z } from "zod";
import { type Failure, fail, type Plan } from "./plan.js";

/** The parts of Site Settings AI apps may change (4.11, AIB-2): what the business is. */
const PARTS = ["general", "address", "contact", "social", "search"] as const;

/** One of {@link PARTS}. */
type Part = (typeof PARTS)[number];

/** What an unknown key is answered with: publishing, forms, analytics and code stay the person's. */
const notTheirs = {
  error: (issue: { code?: string; keys?: readonly string[] }) =>
    issue.code === "unrecognized_keys"
      ? `AI apps can't change ${(issue.keys ?? []).join(", ")}: only the business's name, description, language and type, its web address, contact details, opening hours, social profiles and search settings. Publishing, forms, analytics, code, search engines' verification codes, the icon and pictures stay the person's.`
      : undefined,
};

const { general, address, contact, social, search } = siteSettingsSchema.shape;

/**
 * What `updateSettings` takes: any of the business's settings, each as `settings` gives it. A value
 * of `null` clears an optional one; what's left out stays as it is.
 */
const settingsChange = z
  .strictObject(
    {
      general: z
        .strictObject(
          {
            name: general.shape.name.optional(),
            description: general.shape.description.nullable(),
            language: general.shape.language.optional(),
            businessType: general.shape.businessType.nullable(),
            businessKind: general.shape.businessKind.nullable(),
          },
          notTheirs,
        )
        .optional(),
      address: z.strictObject({ url: address.shape.url.nullable() }, notTheirs).optional(),
      contact: z
        .strictObject(
          {
            businessName: contact.shape.businessName.nullable(),
            email: contact.shape.email.nullable(),
            phone: contact.shape.phone.nullable(),
            address: contact.shape.address.nullable(),
            openingHours: contact.shape.openingHours.optional(),
            openingHoursNote: contact.shape.openingHoursNote.nullable(),
            priceRange: contact.shape.priceRange.nullable(),
            geo: contact.shape.geo.nullable(),
          },
          notTheirs,
        )
        .optional(),
      social: z
        .strictObject(
          { profiles: social.shape.profiles.optional(), xHandle: social.shape.xHandle.nullable() },
          notTheirs,
        )
        .optional(),
      search: z
        .strictObject(
          {
            allowIndexing: search.shape.allowIndexing.optional(),
            includeSitemap: search.shape.includeSitemap.optional(),
            readableByAi: search.shape.readableByAi.nullable(),
            // Not `verification`: a code proves to a search engine that the site is its owner's,
            // so one planted in what an app reads would hand the site's listing to someone else.
          },
          notTheirs,
        )
        .optional(),
    },
    notTheirs,
  )
  .refine(
    (change) => PARTS.some((part) => change[part] !== undefined),
    "Give at least one setting to change.",
  );

/** See {@link settingsChange}. */
type SettingsChange = z.infer<typeof settingsChange>;

/**
 * What Content mode lets an AI app change (§5.10): the name, description, contact details, opening
 * hours and social profiles. Not the language, business type and kind, web address or search.
 */
function structural(change: SettingsChange): boolean {
  const { general } = change;
  return (
    change.address !== undefined ||
    change.search !== undefined ||
    general?.language !== undefined ||
    general?.businessType !== undefined ||
    general?.businessKind !== undefined
  );
}

/** `settings` with `change` over it: `null` deletes, a value replaces, what's left out stays. */
function changed(settings: SiteSettings, change: SettingsChange): unknown {
  const next: Record<string, unknown> = structuredClone(settings);
  for (const part of PARTS) {
    const values = change[part];
    if (values === undefined) continue;
    const group: Record<string, unknown> = { ...(next[part] as object) };
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue;
      if (value === null) delete group[key];
      else group[key] = value;
    }
    next[part] = group;
  }
  return next;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What the person should see before allowing it, from what it was to what it'd be, in the dialog's
 * words (S18's way): the web address and whether search engines may show the site, which decide
 * whether the site is found at all; and where visitors reach the business, its email, phone and
 * each network's profiles.
 */
function namedChanges(before: SiteSettings, after: SiteSettings): string[] {
  const none = t("ai.confirm.noAddress");
  const line = (field: string, from: string | undefined, to: string | undefined) =>
    t("ai.confirm.destinationFromTo", { field, from: from || none, to: to || none });
  const lines: string[] = [];
  if (before.address.url !== after.address.url) {
    lines.push(line(t("site.settings.webAddress"), before.address.url, after.address.url));
  }
  if (before.search.allowIndexing !== after.search.allowIndexing) {
    const shown = (allowed: boolean) => t(allowed ? "ai.confirm.yes" : "ai.confirm.no");
    lines.push(
      line(
        t("site.settings.allowIndexing"),
        shown(before.search.allowIndexing),
        shown(after.search.allowIndexing),
      ),
    );
  }
  if (before.contact.email !== after.contact.email) {
    lines.push(line(t("site.settings.email"), before.contact.email, after.contact.email));
  }
  if (before.contact.phone !== after.contact.phone) {
    lines.push(line(t("site.settings.phone"), before.contact.phone, after.contact.phone));
  }
  const urls = (settings: SiteSettings, network: string) =>
    settings.social.profiles
      .filter((profile) => profile.network === network)
      .map((profile) => profile.url)
      .join(", ");
  const networks = new Set(
    [...before.social.profiles, ...after.social.profiles].map((profile) => profile.network),
  );
  for (const network of networks) {
    const [from, to] = [urls(before, network), urls(after, network)];
    if (from !== to) lines.push(line(t(`site.settings.network.${network}`), from, to));
  }
  return lines;
}

/**
 * Changes the business part of Site Settings (4.11, AIB-2): its name, description, language and
 * type, web address, contact details, opening hours, social profiles and search settings. Never
 * publishing, forms, analytics, Custom Code, search engines' verification codes or pictures: those
 * stay the person's (F-AI-1). The name and contact details show on every page, so it asks once (D7),
 * naming a changed web address, search engines' permission, phone, email or social profile from
 * what it was to what it'd be, as S18 does for payment links.
 */
export const updateSettings = {
  description:
    "Changes Site Settings that say what the business is: general (name, description, language, businessType, businessKind), address (the web address), contact (business name, email, phone, postal address, opening hours, note, price range, map position), social (profiles, X handle) and search (allowIndexing, includeSitemap, readableByAi). Each as the settings query gives it; null clears an optional one, and what's left out stays. Never publishing, forms, analytics, code, search engines' verification codes, the icon or pictures. They show on every page, so it waits for the person to allow it. One undo step.",
  input: settingsChange,
  plan(site: SiteDoc, input: SettingsChange): Plan | Failure {
    const before = site.settings;
    const parsed = siteSettingsSchema.safeParse(changed(before, input));
    if (!parsed.success) return fail("invalid", z.prettifyError(parsed.error));
    const after = parsed.data;
    const parts = PARTS.filter((part: Part) => !same(before[part], after[part]));
    if (parts.length === 0) return fail("invalid", "Site Settings are already like that.");
    const sections = parts.map((part) => t(`site.settings.section.${part}`)).join(", ");
    const lines = namedChanges(before, after);
    return {
      action: t("site.settings.historySections", { sections }),
      structural: structural(input),
      kind: "props",
      confirm: (app) => ({
        action: t("ai.confirm.settings", { app, sections }),
        ...(lines.length === 0 ? {} : { description: lines.join(" ") }),
        confirm: t("ai.confirm.allow"),
        affectedPages: site.pageOrder.length,
      }),
      recipe: (draft) => {
        draft.settings = structuredClone(after);
      },
    };
  },
};
