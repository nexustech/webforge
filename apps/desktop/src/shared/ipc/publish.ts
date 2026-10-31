import {
  fileTransferDestinationSchema,
  fileTransferTrustSchema,
  HOST_MAX,
  hostKeySchema,
  SECRET_MAX,
} from "@webforge/model";
import { z } from "zod";

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
}
