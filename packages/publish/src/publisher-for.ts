import {
  DEFAULT_PORTS,
  type FileTransferSignIn,
  type FileTransferTrust,
  type PublishDestination,
} from "@webforge/model";
import { ftpPublisher } from "./ftp.js";
import type { PublishedSite } from "./manifest.js";
import { netlifyPublisher } from "./netlify.js";
import {
  type BuildOutput,
  PublishError,
  type PublishErrorCode,
  type Publisher,
  type TestResult,
} from "./publisher.js";
import { type PublishRunEvent, type PublishRunOptions, publishSite } from "./run.js";
import { sftpPublisher } from "./sftp.js";

/**
 * How a destination signs in, as the main process reads it from the keychain: a file-transfer
 * password or private key, or Netlify's token (4.4b). Never stored with the destination.
 */
export type PublishSignIn = FileTransferSignIn | { readonly token: string };

/** Which site is published, for the remote manifest (A8), and whether to replace another's. */
export type PublishTarget = {
  readonly site: PublishedSite;
  /** The person agreed to replace the site of another project in the folder (4.5). */
  readonly replaceOtherSite?: boolean;
};

/** A destination with its sign-in and trust: what Test connection and Publish call. */
export type DestinationPublisher = {
  /** Signs in and looks at the destination, publishing nothing (4.3's Test connection). */
  test(signal?: AbortSignal): Promise<TestResult>;
  /** Publishes `build` as `target`'s site, then checks the live site ({@link publishSite}). */
  publish(
    build: BuildOutput,
    target: PublishTarget,
    signal: AbortSignal,
    options?: PublishRunOptions,
  ): AsyncIterable<PublishRunEvent>;
};

/**
 * A destination as {@link publisherFor} reads it: its kind and settings, without the id and name
 * the site's list keeps it by.
 */
export type PublishTo = PublishDestination extends infer D
  ? D extends PublishDestination
    ? Omit<D, "id" | "name">
    : never
  : never;

/** Options of {@link publisherFor}. */
export type PublisherForOptions = {
  /** How long connecting and each step may take, for the file-transfer publishers. */
  readonly timeoutMs?: number;
};

/** A publisher that can't be used: each call fails with `code`, before anything is sent. */
function unusable(code: PublishErrorCode, why: string): DestinationPublisher {
  return {
    test: async () => ({ ok: false, code }),
    // biome-ignore lint/correctness/useYield: it fails before it would yield anything.
    async *publish() {
      throw new PublishError(code, why);
    },
  };
}

/** `publisher` bound to the destination `test` gives, and `toward` gives with a target's site. */
function bound<D>(
  publisher: Publisher<D>,
  test: Omit<D, "site" | "replaceOtherSite">,
  toward: (target: PublishTarget) => D,
): DestinationPublisher {
  return {
    test: (signal) => publisher.test(test, signal),
    publish: (build, target, signal, options) =>
      publishSite(publisher, build, toward(target), signal, options),
  };
}

/** What a file-transfer destination adds for one publish: the site, and leave to replace another. */
const forSite = ({ site, replaceOtherSite }: PublishTarget) => ({
  site,
  ...(replaceOtherSite === true ? { replaceOtherSite: true } : {}),
});

/**
 * The publisher for `destination`, signed in with `signIn` and trusting what `trust` says
 * (ADR 0018 §2): the only place that knows each publisher's fields. A sign-in of the wrong kind,
 * or an SFTP destination with no trusted host key, gives a publisher that refuses before
 * connecting: `unauthorized` or `untrusted-host`.
 */
export function publisherFor(
  destination: PublishTo,
  signIn: PublishSignIn,
  trust: FileTransferTrust,
  options: PublisherForOptions = {},
): DestinationPublisher {
  const timeout = options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs };
  if (destination.kind === "netlify") {
    if (!("token" in signIn)) return unusable("unauthorized", "Netlify signs in with a token");
    if (destination.siteId === undefined) {
      return unusable("not-found", "The Netlify site hasn't been chosen yet");
    }
    const netlify = { siteId: destination.siteId };
    return bound(netlifyPublisher({ token: signIn.token }), netlify, () => netlify);
  }
  const { settings } = destination;
  const at = {
    host: settings.host,
    port: settings.port ?? DEFAULT_PORTS[settings.protocol],
    user: settings.user,
    folder: settings.folder,
    ...(settings.url === undefined ? {} : { url: settings.url }),
  };
  if ("token" in signIn) return unusable("unauthorized", "File transfer signs in with a password");
  if (settings.protocol === "sftp") {
    if (trust.hostKey === undefined) {
      return unusable("untrusted-host", "The host's key hasn't been trusted yet");
    }
    const sftp =
      "password" in signIn
        ? { password: signIn.password, ...timeout }
        : {
            privateKey: signIn.privateKey,
            ...(signIn.passphrase === undefined ? {} : { passphrase: signIn.passphrase }),
            ...timeout,
          };
    const dest = { ...at, hostKey: trust.hostKey };
    return bound(sftpPublisher(sftp), dest, (target) => ({ ...dest, ...forSite(target) }));
  }
  // FTPS and FTP sign in with a password only.
  if (!("password" in signIn)) return unusable("unauthorized", "FTP signs in with a password");
  const dest = { ...at, protocol: settings.protocol };
  return bound(ftpPublisher({ password: signIn.password, ...timeout }), dest, (target) => ({
    ...dest,
    ...forSite(target),
  }));
}
