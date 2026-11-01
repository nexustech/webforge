import { createHash } from "node:crypto";
import {
  DEFAULT_PORTS,
  type FileTransferTrust,
  fileTransferSignInSchema,
  fileTransferTrustSchema,
  type PublishDestination,
  SECRET_MAX,
} from "@webforge/model";
import type { PublishSignIn } from "@webforge/publish";
import { z } from "zod";
import type { SignInState } from "../shared/ipc/publish.js";
import { type CredentialStore, publishCredentialKey } from "./credential-store.js";

/**
 * What the keychain keeps for one destination (4.4a, security review S2), encrypted as one: how it
 * signs in, what this computer trusts about it, and the fingerprint of where it was typed for.
 * Kept together, so an edited site file, or an edited trust, can't pair the secret with another
 * host: the fingerprint has to match the destination as the site file names it now.
 */
const savedSchema = z.strictObject({
  version: z.literal(1),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  signIn: z.union([
    fileTransferSignInSchema,
    z.strictObject({ token: z.string().min(1).max(SECRET_MAX) }),
  ]),
  trust: fileTransferTrustSchema,
});

/** A destination's sign-in, with what this computer trusts about it. */
type SavedSignIn = { readonly signIn: PublishSignIn; readonly trust: FileTransferTrust };

/**
 * Where a secret is given (S2): a file-transfer destination's protocol, host, port and user, and
 * the SFTP host key trusted; a Netlify destination always signs in at Netlify. A SHA-256, so the
 * keychain's record says nothing of the host by itself.
 */
export function destinationFingerprint(
  destination: PublishDestination,
  trust: FileTransferTrust,
): string {
  const where =
    destination.kind === "netlify"
      ? ["netlify"]
      : [
          "file-transfer",
          destination.settings.protocol,
          destination.settings.host.toLowerCase(),
          destination.settings.port ?? DEFAULT_PORTS[destination.settings.protocol],
          destination.settings.user,
          destination.settings.protocol === "sftp" ? (trust.hostKey ?? null) : null,
        ];
  return createHash("sha256").update(JSON.stringify(where)).digest("hex");
}

/** The open site's destinations' secrets, by its project id: on this computer only (ADR 0018). */
export type PublishSecrets = {
  /** Whether `destination`'s sign-in is saved, for it as it is now, with what is trusted. */
  state(
    projectId: string,
    destination: PublishDestination,
  ): Promise<{ readonly signIn: SignInState; readonly trust: FileTransferTrust }>;
  /**
   * `destination`'s sign-in and trust, only while it is the destination they were saved for
   * (`trust` for it, by default what was saved): a changed host gets nothing (S2).
   */
  signInFor(
    projectId: string,
    destination: PublishDestination,
    trust?: FileTransferTrust,
  ): Promise<SavedSignIn | undefined>;
  /** Saves `destination`'s sign-in and trust, for it as it is now. Throws `CredentialError`. */
  save(
    projectId: string,
    destination: PublishDestination,
    signIn: PublishSignIn,
    trust: FileTransferTrust,
  ): Promise<void>;
  /** Forgets destination `destinationId`'s sign-in and trust. */
  remove(projectId: string, destinationId: string): Promise<void>;
};

/** The destinations' secrets in `store`, under `publish/<projectId>/<destinationId>` (#666). */
export function createPublishSecrets(store: CredentialStore): PublishSecrets {
  const read = async (projectId: string, destinationId: string) => {
    const text = await store.get(publishCredentialKey(projectId, destinationId));
    if (text === null) return undefined;
    try {
      const saved = savedSchema.safeParse(JSON.parse(text));
      return saved.success ? saved.data : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    async state(projectId, destination) {
      const saved = await read(projectId, destination.id);
      if (saved === undefined) return { signIn: "none", trust: {} };
      return destinationFingerprint(destination, saved.trust) === saved.fingerprint
        ? { signIn: "saved", trust: saved.trust }
        : { signIn: "changed", trust: {} };
    },
    async signInFor(projectId, destination, trust) {
      const saved = await read(projectId, destination.id);
      if (saved === undefined) return undefined;
      const trusted = trust ?? saved.trust;
      if (destinationFingerprint(destination, trusted) !== saved.fingerprint) return undefined;
      return { signIn: saved.signIn, trust: trusted };
    },
    async save(projectId, destination, signIn, trust) {
      const saved = {
        version: 1,
        fingerprint: destinationFingerprint(destination, trust),
        signIn,
        trust,
      };
      await store.set(publishCredentialKey(projectId, destination.id), JSON.stringify(saved));
    },
    remove: (projectId, destinationId) =>
      store.delete(publishCredentialKey(projectId, destinationId)),
  };
}
