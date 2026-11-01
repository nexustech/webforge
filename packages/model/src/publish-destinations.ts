import { z } from "zod";
import { fileTransferDestinationSchema, siteAddressSchema } from "./file-transfer.js";

/** The most destinations a site may have (4.4a): a few hosts, never hundreds. */
export const PUBLISH_DESTINATIONS_MAX = 20;

/** The longest name a destination may have ("Shop on Krystal"). */
export const DESTINATION_NAME_MAX = 100;

/** What every destination has: its id, which keys its secret, and the name the list shows. */
const common = {
  id: z.uuid(),
  name: z.string().trim().min(1).max(DESTINATION_NAME_MAX),
};

/**
 * A place the site is published to (B1, ADR 0018 §2), as the site file keeps it: beside the site
 * document, in its `meta` table, so it is never undone or copied into a version. Its secret, and
 * what this computer trusts about it (an SFTP host key, plain FTP's warning seen), stay in the OS
 * keychain and userData under the site's project id and the destination's `id`, never here.
 */
export const publishDestinationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("file-transfer"),
    /** FTPS, FTP or SFTP (4.3): the host, folder and address, and how it signs in. */
    settings: fileTransferDestinationSchema,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("netlify"),
    /** Netlify's id of the site, once the first publish has created or chosen it (4.4b). */
    siteId: z
      .string()
      .regex(/^[0-9a-f-]{36}$/)
      .optional(),
    /** The address Netlify gave the site, which the live check asks for. */
    url: siteAddressSchema.optional(),
  }),
]);

/** See {@link publishDestinationSchema}. */
export type PublishDestination = z.infer<typeof publishDestinationSchema>;

/** A site's destinations as written: each one valid, each id once, at most the maximum. */
export const publishDestinationsSchema = z
  .array(publishDestinationSchema)
  .max(PUBLISH_DESTINATIONS_MAX)
  .refine((list) => new Set(list.map(({ id }) => id)).size === list.length, {
    message: "Each destination needs its own id",
  });

/**
 * The destinations in `stored`, as the site file holds them: each entry checked on its own, so one
 * damaged entry, or a second one with the same id, is left out without losing the others (ADR 0018
 * §2). Anything that isn't a list reads as none.
 */
export function publishDestinationsFrom(stored: unknown): PublishDestination[] {
  if (!Array.isArray(stored)) return [];
  const ids = new Set<string>();
  const list: PublishDestination[] = [];
  for (const entry of stored) {
    const parsed = publishDestinationSchema.safeParse(entry);
    if (!parsed.success || ids.has(parsed.data.id)) continue;
    ids.add(parsed.data.id);
    list.push(parsed.data);
    if (list.length === PUBLISH_DESTINATIONS_MAX) break;
  }
  return list;
}
