import { createHash } from "node:crypto";
import { join } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import { withRunnableCode } from "@webforge/pipeline";
import { z } from "zod";
import { createJsonStore, type JsonStoreFiles } from "./json-store.js";
import { logFailure } from "./log.js";

/**
 * The code each site's owner trusts on this computer (#649, S1 and S6): a site's own code runs for
 * its visitors, and in Preview in the owner's browser, only once its owner has written it here or
 * confirmed it. Kept in the app's user data, never in the site's file, so a file can't vouch for
 * itself: by site (its project id) and the SHA-256 of each piece's text, never the text itself.
 */

/** The most pieces kept for one site; the oldest confirmed go first. */
const MAX_PER_SITE = 1000;

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);

const fileSchema = z.strictObject({
  version: z.literal(1),
  /** Each site's trusted pieces, by project id, oldest first. */
  sites: z.record(z.uuid(), z.array(hashSchema)),
});

type TrustFile = z.infer<typeof fileSchema>;

const EMPTY: TrustFile = { version: 1, sites: {} };

/** A piece of code as the record keeps it. */
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/** Which of a site's code is trusted, for a build: none of a piece it hasn't seen. */
export type TrustedCode = (text: string) => boolean;

/** What {@link createCodeTrust} gives. */
export type CodeTrust = ReturnType<typeof createCodeTrust>;

/**
 * The trust record, in `code-trust.json` in `dir`. A damaged file is read as empty and replaced:
 * the owner is asked again, which costs them a click.
 */
export function createCodeTrust(options: {
  readonly dir: string;
  readonly max?: number;
  readonly files?: JsonStoreFiles;
}) {
  const max = options.max ?? MAX_PER_SITE;
  const store = createJsonStore(join(options.dir, "code-trust.json"), fileSchema, {
    empty: EMPTY,
    onDamaged: "reset",
    ...(options.files === undefined ? {} : { files: options.files }),
  });
  /** The file as last read or written: read once, then kept. */
  let known: Promise<TrustFile> | undefined;
  const read = () => {
    known ??= store.read().catch((error: unknown) => {
      known = undefined;
      throw error;
    });
    return known;
  };

  return {
    /** Which code of the site `projectId` is trusted, as it stands now. */
    async trusted(projectId: string): Promise<TrustedCode> {
      const hashes = new Set((await read()).sites[projectId] ?? []);
      return (text) => hashes.has(hashOf(text));
    },
    /** Trusts `texts` for the site `projectId`, from now on. */
    async trust(projectId: string, texts: readonly string[]): Promise<void> {
      const added = texts.map(hashOf);
      if (added.length === 0) return;
      let next: TrustFile | undefined;
      await store.update((current) => {
        const kept = (current.sites[projectId] ?? []).filter((hash) => !added.includes(hash));
        next = {
          version: 1,
          sites: { ...current.sites, [projectId]: [...kept, ...new Set(added)].slice(-max) },
        };
        return next;
      });
      if (next !== undefined) known = Promise.resolve(next);
    },
    /** Resolves once every write asked so far is done: before the app exits. */
    idle: () => store.idle(),
  };
}

/**
 * `snapshot`, of the site `projectId`, with only the code its owner has written here or confirmed
 * (#649, S1 and S6): the rest is left out of the build, an export's, a preview's or a publish's,
 * whatever the renderer sent. With no site open, or a record that can't be read, none goes in.
 */
export async function withTrustedCode(
  snapshot: SiteSnapshot,
  projectId: string | undefined,
  trust: Pick<CodeTrust, "trusted">,
): Promise<SiteSnapshot> {
  let trusted: TrustedCode = () => false;
  if (projectId !== undefined) {
    try {
      trusted = await trust.trusted(projectId);
    } catch (error) {
      logFailure("Webforge could not read which code is trusted", error);
    }
  }
  return withRunnableCode(snapshot, trusted);
}
