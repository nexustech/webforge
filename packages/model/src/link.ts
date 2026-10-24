import { z } from "zod";
import { mediaIdSchema, pageIdSchema } from "./ids.js";

/** The longest an anchor may be. */
export const ANCHOR_ID_MAX = 64;

/**
 * An anchor on a page, e.g. `opening-times` in `about.html#opening-times`: a section's
 * `advanced.anchorId`, created when the user first links to it (F-ED-18).
 */
export const anchorIdSchema = z
  .string()
  .max(ANCHOR_ID_MAX)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

/** `https://` or `http://` with a host. */
export const webUrlSchema = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });

const newTab = z.boolean().optional();

/**
 * A phone number as people type it: digits, spaces, brackets, dashes and a leading +, e.g.
 * `+44 1234 567890` or `(01234) 567890`.
 */
export const phoneNumberSchema = z.string().regex(/^\+?[0-9(][0-9 ()-]{2,30}$/);

/** A page of the site, and optionally a section on it. */
export const pageLinkSchema = z.strictObject({
  kind: z.literal("page"),
  pageId: pageIdSchema,
  anchor: anchorIdSchema.optional(),
  newTab,
});

/**
 * Where a link goes (F-ED-18): a page of the site (optionally a section on it), an e-mail address,
 * a phone number, a web address or a file in Media. Internal links store the page's id, so renaming
 * the page or changing its folder never breaks them; the export turns them into relative paths.
 */
/** The longest subject an e-mail link can fill in. */
export const EMAIL_SUBJECT_MAX = 200;

export const linkValueSchema = z.discriminatedUnion("kind", [
  pageLinkSchema,
  z.strictObject({
    kind: z.literal("email"),
    address: z.email(),
    subject: z.string().max(EMAIL_SUBJECT_MAX).optional(),
    newTab,
  }),
  z.strictObject({ kind: z.literal("phone"), number: phoneNumberSchema, newTab }),
  z.strictObject({ kind: z.literal("url"), href: webUrlSchema, newTab }),
  z.strictObject({
    kind: z.literal("file"),
    mediaId: mediaIdSchema,
    newTab,
    /** Saves the file instead of opening it (the link's `download` attribute, 1.28). */
    download: z.boolean().optional(),
  }),
]);

/** See {@link linkValueSchema}. */
export type LinkValue = z.infer<typeof linkValueSchema>;
