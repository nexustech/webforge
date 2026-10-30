import { z } from "zod";

/**
 * How a file-transfer destination sends the site (B5, 4.3), in the order the app offers them:
 * FTPS (FTP over TLS, which most shared hosts have), SFTP (over SSH), then plain FTP, which sends
 * the password and the files unencrypted and is offered only with a warning.
 */
export const FILE_TRANSFER_PROTOCOLS = ["ftps", "sftp", "ftp"] as const;

/** One of {@link FILE_TRANSFER_PROTOCOLS}. */
export type FileTransferProtocol = (typeof FILE_TRANSFER_PROTOCOLS)[number];

/** The port each protocol uses when the destination names none. */
export const DEFAULT_PORTS: Readonly<Record<FileTransferProtocol, number>> = {
  ftps: 21,
  ftp: 21,
  sftp: 22,
};

/** The longest host name DNS allows. */
export const HOST_MAX = 253;
/** The longest user name a destination takes. */
export const FILE_TRANSFER_USER_MAX = 256;
/** The longest folder path a destination takes. */
export const FOLDER_MAX = 1024;
/** The largest private key file the app reads: an RSA 4096 key in PEM is about 3.3 KB. */
export const PRIVATE_KEY_MAX = 16 * 1024;
/** The longest password or passphrase the app sends. */
export const SECRET_MAX = 1024;

/** A host's name or address, as the host's control panel gives it: `ftp.example.com`. */
const hostSchema = z
  .string()
  .min(1)
  .max(HOST_MAX)
  .regex(
    /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$|^[0-9A-Fa-f:.]+$/,
  );

/** A folder on the host, from the root the login sees: `/public_html`, `/www/shop`. */
const folderSchema = z
  .string()
  .min(1)
  .max(FOLDER_MAX)
  // Control characters would reach the host's commands.
  .regex(/^\P{Cc}+$/u);

/** The address the site is visited at once published (X3): `https://` only. */
const siteAddressSchema = z.url({ protocol: /^https$/, hostname: z.regexes.domain }).max(2048);

/** An SSH host key's fingerprint as OpenSSH shows it: `SHA256:` and 43 base64 characters. */
export const hostKeySchema = z.string().regex(/^SHA256:[A-Za-z0-9+/]{43}$/);

/** What every file-transfer destination has. */
const common = {
  host: hostSchema,
  /** The protocol's usual port ({@link DEFAULT_PORTS}) when left out. */
  port: z.number().int().min(1).max(65_535).optional(),
  user: z.string().min(1).max(FILE_TRANSFER_USER_MAX),
  folder: folderSchema,
  url: siteAddressSchema.optional(),
};

/**
 * An FTPS or plain FTP destination's settings, as the site keeps them: never its password, which
 * lives in the OS keychain (architecture §9).
 */
const ftpDestinationSchema = z.strictObject({
  protocol: z.enum(["ftps", "ftp"]),
  ...common,
  /**
   * The person has seen plain FTP's warning for this destination (B5): it shows once per
   * destination, the first time it is set to plain FTP.
   */
  plainFtpWarned: z.literal(true).optional(),
});

/** An SFTP destination's settings, as the site keeps them: never its password or private key. */
const sftpDestinationSchema = z.strictObject({
  protocol: z.literal("sftp"),
  ...common,
  /** Whether it signs in with a password or a private key (4.3). */
  signIn: z.enum(["password", "key"]),
  /**
   * The host key the person trusted the first time (ADR 0006 §7): any other is refused before
   * anything is sent. Absent until they have.
   */
  hostKey: hostKeySchema.optional(),
});

/** A destination the site is published to over FTPS, SFTP or FTP (F-PB-1, 4.3). */
export const fileTransferDestinationSchema = z.discriminatedUnion("protocol", [
  ftpDestinationSchema,
  sftpDestinationSchema,
]);

/** A file-transfer destination's settings. */
export type FileTransferDestination = z.infer<typeof fileTransferDestinationSchema>;

/**
 * How a file-transfer destination signs in, for Test connection and publishing: its password, or
 * an SFTP private key (OpenSSH or PEM text, as its file holds it) and the key's passphrase. Never
 * part of the site; the app keeps it in the OS keychain (4.4).
 */
export const fileTransferSignInSchema = z.union([
  z.strictObject({ password: z.string().min(1).max(SECRET_MAX) }),
  z.strictObject({
    privateKey: z.string().min(1).max(PRIVATE_KEY_MAX),
    passphrase: z.string().min(1).max(SECRET_MAX).optional(),
  }),
]);

/** How a file-transfer destination signs in. */
export type FileTransferSignIn = z.infer<typeof fileTransferSignInSchema>;
