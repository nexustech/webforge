import {
  DESTINATION_NAME_MAX,
  fileTransferDestinationSchema,
  fileTransferTrustSchema,
  HOST_MAX,
  hostKeySchema,
  publishDestinationSchema,
  SECRET_MAX,
} from "@webforge/model";
import { z } from "zod";
import { sessionIdSchema } from "./project.js";

/**
 * Why a connection test failed (`PublishErrorCode` of `@webforge/publish`), which the destination
 * form words for the person.
 */
const CONNECTION_FAILURES = [
  "unauthorized",
  "not-found",
  "rate-limited",
  "rejected",
  "network",
  "untrusted-host",
  "no-encryption",
  "bad-key",
  "other-site",
  "cancelled",
  "failed",
] as const;

/** What Test connection found: the folder can be published to, or why not. */
const connectionResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), code: z.enum(CONNECTION_FAILURES) }),
]);

/** What Test connection found. */
export type ConnectionResult = z.infer<typeof connectionResultSchema>;

/** The key an SFTP host presents, for the person to trust the first time, or why it couldn't be read. */
const hostKeyResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("read"), hostKey: hostKeySchema }),
  z.strictObject({ status: z.literal("failed"), code: z.enum(CONNECTION_FAILURES) }),
]);

/** The key an SFTP host presents. */
export type HostKeyResult = z.infer<typeof hostKeyResultSchema>;

/**
 * A private key the main process holds for the renderer (4.3, review): a random handle, so the
 * key's text never reaches the renderer. Main keeps the key in memory under it until 4.4 moves it
 * to the keychain.
 */
const keyHandleSchema = z.uuid();

/**
 * How a test signs in, as the renderer gives it: the password typed, or an SFTP key's handle and
 * the key's passphrase, if it has one.
 */
const signInRefSchema = z.union([
  z.strictObject({ password: z.string().min(1).max(SECRET_MAX) }),
  z.strictObject({
    keyHandle: keyHandleSchema,
    passphrase: z.string().min(1).max(SECRET_MAX).optional(),
  }),
]);

/** How a test signs in, as the renderer gives it. */
export type SignInRef = z.infer<typeof signInRefSchema>;

/**
 * A private key file the person chose for SFTP (4.3): its name, to show; whether it needs a
 * passphrase; and its handle, the key itself staying in the main process. Or why it can't be
 * used: unreadable, too large to be a key, not a private key, or a key in a format SFTP sign-in
 * can't read (PKCS#8).
 */
const keyFileResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("chosen"),
    name: z.string().min(1).max(255),
    encrypted: z.boolean(),
    handle: keyHandleSchema,
  }),
  z.strictObject({ status: z.literal("cancelled") }),
  z.strictObject({
    status: z.literal("failed"),
    reason: z.enum(["unreadable", "too-large", "not-a-key", "unsupported"]),
  }),
]);

/** A private key file the person chose. */
export type KeyFileResult = z.infer<typeof keyFileResultSchema>;

/**
 * Whether a destination's sign-in is saved on this computer (4.4a, security review S2): `saved` for
 * the destination as it is now; `changed` when it was saved for another protocol, host, port, user
 * or host key than the site file now names, so it is given to no one until typed again; `none`.
 */
const signInStateSchema = z.enum(["saved", "changed", "none"]);

/** See {@link signInStateSchema}. */
export type SignInState = z.infer<typeof signInStateSchema>;

/** Why a call about the open site's destinations did nothing. */
const destinationsFailureSchema = z.strictObject({
  status: z.literal("failed"),
  reason: z.enum([
    "no-site",
    "stale-session",
    "read-only",
    // This computer can't keep secrets encrypted (no keychain on some Linux desktops).
    "no-keychain",
    // A key file the main process no longer holds: chosen too long ago.
    "bad-key",
    // The site has as many destinations as it may.
    "full",
    "unknown",
  ]),
});

/** One destination of the open site, with what this computer keeps for it. */
const listedDestinationSchema = z.strictObject({
  destination: publishDestinationSchema,
  signIn: signInStateSchema,
  /** What this computer trusts about it: kept beside the secret, never in the site file. */
  trust: fileTransferTrustSchema,
});

const destinationsResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("listed"), destinations: z.array(listedDestinationSchema) }),
  destinationsFailureSchema,
]);

/** See {@link publishChannels}' `publishDestinations`. */
export type DestinationsResult = z.infer<typeof destinationsResultSchema>;

/** A file-transfer destination as the destination form saves it: a new one has no id yet. */
const destinationDraftSchema = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(DESTINATION_NAME_MAX),
  settings: fileTransferDestinationSchema,
});

/** See {@link destinationDraftSchema}. */
type DestinationDraft = z.input<typeof destinationDraftSchema>;

/**
 * How a saved destination signs in: as typed, or `keep` to keep the sign-in saved for it, which
 * main allows only while the protocol, host, port, user and host key are those it was saved for.
 */
const savedSignInSchema = z.union([signInRefSchema, z.strictObject({ keep: z.literal(true) })]);

/** See {@link savedSignInSchema}. */
type SavedSignInRef = z.infer<typeof savedSignInSchema>;

const saveDestinationResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("saved"), destination: publishDestinationSchema }),
  /** `keep` for a destination whose sign-in isn't saved for it as it is now: type it again. */
  z.strictObject({ status: z.literal("sign-in-needed") }),
  destinationsFailureSchema,
]);

/** See {@link publishChannels}' `publishSaveDestination`. */
export type SaveDestinationResult = z.infer<typeof saveDestinationResultSchema>;

const removeDestinationResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("removed") }),
  destinationsFailureSchema,
]);

/** See {@link publishChannels}' `publishRemoveDestination`. */
export type RemoveDestinationResult = z.infer<typeof removeDestinationResultSchema>;

const testSavedResultSchema = z.union([connectionResultSchema, destinationsFailureSchema]);

/** See {@link publishChannels}' `publishTestSavedDestination`. */
type TestSavedResult = z.infer<typeof testSavedResultSchema>;

/** IPC channels of the `publish` domain (`publish:*`). Each one's arguments are checked. */
export const publishChannels = {
  /**
   * Test connection (F-PB-1, B5): signs in to the destination with `signIn` and opens its folder.
   * An FTPS destination on a host without FTPS answers `no-encryption`; an SFTP one whose host key
   * isn't trusted yet, `untrusted-host`. Nothing is uploaded, and the secrets are kept nowhere.
   */
  publishTestConnection: {
    channel: "publish:testConnection",
    request: z.tuple([fileTransferDestinationSchema, signInRefSchema, fileTransferTrustSchema]),
    response: connectionResultSchema,
  },
  /** The key an SFTP host presents, without signing in (ADR 0006 §7). */
  publishReadHostKey: {
    channel: "publish:readHostKey",
    request: z.tuple([
      z.string().min(1).max(HOST_MAX),
      z.number().int().min(1).max(65_535).optional(),
    ]),
    response: hostKeyResultSchema,
  },
  /** Asks for a private key file in the system's dialog and reads it. */
  publishChooseKeyFile: {
    channel: "publish:chooseKeyFile",
    request: z.tuple([]),
    response: keyFileResultSchema,
  },
  /** The open site's destinations (4.4a), with whether each one's sign-in is saved here. */
  publishDestinations: {
    channel: "publish:destinations",
    request: z.tuple([sessionIdSchema]),
    response: destinationsResultSchema,
  },
  /**
   * Adds a destination to the open site, or changes one: its settings to the site file, its
   * sign-in and trust to this computer's keychain and data (S2), never the site file.
   */
  publishSaveDestination: {
    channel: "publish:saveDestination",
    request: z.tuple([
      sessionIdSchema,
      destinationDraftSchema,
      savedSignInSchema,
      fileTransferTrustSchema,
    ]),
    response: saveDestinationResultSchema,
  },
  /** Removes a destination from the open site, and its sign-in and trust from this computer. */
  publishRemoveDestination: {
    channel: "publish:removeDestination",
    request: z.tuple([sessionIdSchema, z.uuid()]),
    response: removeDestinationResultSchema,
  },
  /**
   * Test connection for a saved destination being edited, with the sign-in saved for it: only
   * while `settings` and `trust` are what it was saved for (S2), and `unauthorized` otherwise.
   */
  publishTestSavedDestination: {
    channel: "publish:testSavedDestination",
    request: z.tuple([
      sessionIdSchema,
      z.uuid(),
      fileTransferDestinationSchema,
      fileTransferTrustSchema,
    ]),
    response: testSavedResultSchema,
  },
} as const;

/** `window.webforge.publish`: publishing's calls to the main process (Phase 4). */
export interface PublishApi {
  /** Test connection: whether the site can be published to `destination` with `signIn`. */
  testConnection(
    destination: z.input<typeof fileTransferDestinationSchema>,
    signIn: SignInRef,
    trust: z.input<typeof fileTransferTrustSchema>,
  ): Promise<ConnectionResult>;
  /** The key the SFTP host at `host` presents, for the person to trust. */
  readHostKey(host: string, port?: number): Promise<HostKeyResult>;
  /** A private key file the person chooses, read. */
  chooseKeyFile(): Promise<KeyFileResult>;
  /** The destinations of the site `sessionId` opened, with what this computer keeps for each. */
  destinations(sessionId: string): Promise<DestinationsResult>;
  /** Adds or changes one of the site's destinations, with how it signs in and what is trusted. */
  saveDestination(
    sessionId: string,
    draft: DestinationDraft,
    signIn: SavedSignInRef,
    trust: z.input<typeof fileTransferTrustSchema>,
  ): Promise<SaveDestinationResult>;
  /** Removes one of the site's destinations, with what this computer kept for it. */
  removeDestination(sessionId: string, id: string): Promise<RemoveDestinationResult>;
  /** Test connection for destination `id` as edited, with the sign-in saved for it. */
  testSavedDestination(
    sessionId: string,
    id: string,
    settings: z.input<typeof fileTransferDestinationSchema>,
    trust: z.input<typeof fileTransferTrustSchema>,
  ): Promise<TestSavedResult>;
}
