// Why a publish or a connection test failed, with no imports (`@webforge/publish/codes`, #988):
// the app's shared/ code derives its own lists from it, which run in the renderer too.

/**
 * Why a publish or a connection test failed (A23). The app shows a message of its own for each:
 * `publish.failed.<code>` after a publish and `publish.test.<code>` after Test Connection, which
 * the i18n tests check exist for every code.
 */
export const PUBLISH_ERROR_CODES = [
  /** The sign-in or password was refused, or has expired. */
  "unauthorized",
  /** The site or folder no longer exists at the destination. */
  "not-found",
  /** The destination asked us to slow down; try again later. */
  "rate-limited",
  /** The destination refused the files or the request (e.g. a validation error). */
  "rejected",
  /** The destination could not be reached. */
  "network",
  /**
   * The destination didn't answer in time: the connection or a reply timed out, or Netlify didn't
   * finish a deploy, or a sign-in wasn't approved, within the time allowed.
   */
  "timeout",
  /**
   * The server isn't the one trusted for this destination: an SFTP host key that changed, or an
   * FTPS certificate the computer doesn't trust. Nothing was sent.
   */
  "untrusted-host",
  /**
   * An FTPS destination's host doesn't offer encryption (it refused `AUTH TLS`): the person can
   * choose SFTP, if the host has it, or plain FTP after its warning (B5, 4.3).
   */
  "no-encryption",
  /** An SFTP private key that can't be read: not a key, or its passphrase is wrong or missing. */
  "bad-key",
  /**
   * The folder has another site published there with the app (its manifest names another
   * project): nothing was sent, and the app asks before replacing it (A8, 4.5).
   */
  "other-site",
  /** The user cancelled. */
  "cancelled",
  /** Anything else, including a response we did not understand. */
  "failed",
] as const;

/** One of {@link PUBLISH_ERROR_CODES}. */
export type PublishErrorCode = (typeof PUBLISH_ERROR_CODES)[number];
