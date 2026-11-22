import { fileTransferDestinationSchema, fileTransferTrustSchema } from "@webforge/model";
import { z } from "zod";
/**
 * Why a connection test failed: the publisher's codes (`PUBLISH_ERROR_CODES`), each worded by the
 * destination form.
 */
export declare const CONNECTION_FAILURES: readonly [
  "unauthorized",
  "not-found",
  "rate-limited",
  "rejected",
  "network",
  "timeout",
  "untrusted-host",
  "no-encryption",
  "bad-key",
  "other-site",
  "cancelled",
  "failed",
];
/** What Test connection found: the folder can be published to, or why not. */
export declare const connectionResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        ok: z.ZodLiteral<false>;
        code: z.ZodEnum<{
          "bad-key": "bad-key";
          cancelled: "cancelled";
          failed: "failed";
          network: "network";
          "no-encryption": "no-encryption";
          "not-found": "not-found";
          "other-site": "other-site";
          "rate-limited": "rate-limited";
          rejected: "rejected";
          timeout: "timeout";
          unauthorized: "unauthorized";
          "untrusted-host": "untrusted-host";
        }>;
      },
      z.core.$strict
    >,
  ],
  "ok"
>;
/** What Test connection found. */
export type ConnectionResult = z.infer<typeof connectionResultSchema>;
/** The key an SFTP host presents, for the person to trust the first time, or why it couldn't be read. */
declare const hostKeyResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"read">;
        hostKey: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        code: z.ZodEnum<{
          "bad-key": "bad-key";
          cancelled: "cancelled";
          failed: "failed";
          network: "network";
          "no-encryption": "no-encryption";
          "not-found": "not-found";
          "other-site": "other-site";
          "rate-limited": "rate-limited";
          rejected: "rejected";
          timeout: "timeout";
          unauthorized: "unauthorized";
          "untrusted-host": "untrusted-host";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** The key an SFTP host presents. */
export type HostKeyResult = z.infer<typeof hostKeyResultSchema>;
/**
 * How a test signs in, as the renderer gives it: the password typed, or an SFTP key's handle and
 * the key's passphrase, if it has one.
 */
declare const signInRefSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        password: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        keyHandle: z.ZodUUID;
        passphrase: z.ZodOptional<z.ZodString>;
      },
      z.core.$strict
    >,
  ]
>;
/** How a test signs in, as the renderer gives it. */
export type SignInRef = z.infer<typeof signInRefSchema>;
/**
 * A private key file the person chose for SFTP (4.3): its name, to show; whether it needs a
 * passphrase; and its handle, the key itself staying in the main process. Or why it can't be
 * used: unreadable, too large to be a key, not a private key, or a key in a format SFTP sign-in
 * can't read (PKCS#8).
 */
declare const keyFileResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"chosen">;
        name: z.ZodString;
        encrypted: z.ZodBoolean;
        handle: z.ZodUUID;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"cancelled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "not-a-key": "not-a-key";
          "too-large": "too-large";
          unreadable: "unreadable";
          unsupported: "unsupported";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** A private key file the person chose. */
export type KeyFileResult = z.infer<typeof keyFileResultSchema>;
/**
 * How far a publish has come (4.5): the build's stages as an export's, then comparing with what
 * the host has (`preparing`), each file sent (`uploading`, which one of how many), and the live
 * site's check (`verifying`).
 */
export declare const publishProgressSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        stage: z.ZodEnum<{
          images: "images";
          pages: "pages";
          uploading: "uploading";
        }>;
        done: z.ZodInt;
        total: z.ZodInt;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        stage: z.ZodEnum<{
          fonts: "fonts";
          preparing: "preparing";
          styles: "styles";
          verifying: "verifying";
        }>;
      },
      z.core.$strict
    >,
  ],
  "stage"
>;
/** How far a publish has come. */
export type PublishProgress = z.infer<typeof publishProgressSchema>;
/**
 * Whether a destination's sign-in is saved on this computer (4.4a, security review S2): `saved` for
 * the destination as it is now; `changed` when it was saved for another protocol, host, port, user
 * or host key than the site file now names, so it is given to no one until typed again; `none`.
 */
declare const signInStateSchema: z.ZodEnum<{
  changed: "changed";
  none: "none";
  saved: "saved";
}>;
/** See {@link signInStateSchema}. */
export type SignInState = z.infer<typeof signInStateSchema>;
/** Why a call about the open site's destinations did nothing. */
declare const destinationsFailureSchema: z.ZodObject<
  {
    status: z.ZodLiteral<"failed">;
    reason: z.ZodEnum<{
      "bad-key": "bad-key";
      full: "full";
      "no-keychain": "no-keychain";
      "no-site": "no-site";
      "read-only": "read-only";
      "stale-session": "stale-session";
      unknown: "unknown";
    }>;
  },
  z.core.$strict
>;
/** Why a call about the open site's destinations did nothing, for the person to be told. */
export type DestinationsFailure = z.infer<typeof destinationsFailureSchema>["reason"];
/** One destination of the open site, with what this computer keeps for it. */
declare const listedDestinationSchema: z.ZodObject<
  {
    destination: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            id: z.ZodUUID;
            name: z.ZodString;
            kind: z.ZodLiteral<"file-transfer">;
            settings: z.ZodDiscriminatedUnion<
              [
                z.ZodObject<
                  {
                    host: z.ZodPipe<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                    >;
                    port: z.ZodOptional<z.ZodNumber>;
                    user: z.ZodString;
                    folder: z.ZodString;
                    url: z.ZodOptional<z.ZodURL>;
                    redirectRules: z.ZodOptional<z.ZodBoolean>;
                    protocol: z.ZodEnum<{
                      ftp: "ftp";
                      ftps: "ftps";
                    }>;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    host: z.ZodPipe<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                    >;
                    port: z.ZodOptional<z.ZodNumber>;
                    user: z.ZodString;
                    folder: z.ZodString;
                    url: z.ZodOptional<z.ZodURL>;
                    redirectRules: z.ZodOptional<z.ZodBoolean>;
                    protocol: z.ZodLiteral<"sftp">;
                    signIn: z.ZodEnum<{
                      key: "key";
                      password: "password";
                    }>;
                  },
                  z.core.$strict
                >,
              ],
              "protocol"
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            id: z.ZodUUID;
            name: z.ZodString;
            kind: z.ZodLiteral<"netlify">;
            siteId: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodURL>;
          },
          z.core.$strict
        >,
      ],
      "kind"
    >;
    signIn: z.ZodEnum<{
      changed: "changed";
      none: "none";
      saved: "saved";
    }>;
    trust: z.ZodObject<
      {
        hostKey: z.ZodOptional<z.ZodString>;
        plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
      },
      z.core.$strict
    >;
  },
  z.core.$strict
>;
/** A destination as listed. */
export type ListedDestination = z.infer<typeof listedDestinationSchema>;
declare const destinationsResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"listed">;
        destinations: z.ZodArray<
          z.ZodObject<
            {
              destination: z.ZodDiscriminatedUnion<
                [
                  z.ZodObject<
                    {
                      id: z.ZodUUID;
                      name: z.ZodString;
                      kind: z.ZodLiteral<"file-transfer">;
                      settings: z.ZodDiscriminatedUnion<
                        [
                          z.ZodObject<
                            {
                              host: z.ZodPipe<
                                z.ZodString,
                                z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                              >;
                              port: z.ZodOptional<z.ZodNumber>;
                              user: z.ZodString;
                              folder: z.ZodString;
                              url: z.ZodOptional<z.ZodURL>;
                              redirectRules: z.ZodOptional<z.ZodBoolean>;
                              protocol: z.ZodEnum<{
                                ftp: "ftp";
                                ftps: "ftps";
                              }>;
                            },
                            z.core.$strict
                          >,
                          z.ZodObject<
                            {
                              host: z.ZodPipe<
                                z.ZodString,
                                z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                              >;
                              port: z.ZodOptional<z.ZodNumber>;
                              user: z.ZodString;
                              folder: z.ZodString;
                              url: z.ZodOptional<z.ZodURL>;
                              redirectRules: z.ZodOptional<z.ZodBoolean>;
                              protocol: z.ZodLiteral<"sftp">;
                              signIn: z.ZodEnum<{
                                key: "key";
                                password: "password";
                              }>;
                            },
                            z.core.$strict
                          >,
                        ],
                        "protocol"
                      >;
                    },
                    z.core.$strict
                  >,
                  z.ZodObject<
                    {
                      id: z.ZodUUID;
                      name: z.ZodString;
                      kind: z.ZodLiteral<"netlify">;
                      siteId: z.ZodOptional<z.ZodString>;
                      url: z.ZodOptional<z.ZodURL>;
                    },
                    z.core.$strict
                  >,
                ],
                "kind"
              >;
              signIn: z.ZodEnum<{
                changed: "changed";
                none: "none";
                saved: "saved";
              }>;
              trust: z.ZodObject<
                {
                  hostKey: z.ZodOptional<z.ZodString>;
                  plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
                },
                z.core.$strict
              >;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "bad-key": "bad-key";
          full: "full";
          "no-keychain": "no-keychain";
          "no-site": "no-site";
          "read-only": "read-only";
          "stale-session": "stale-session";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** See {@link publishChannels}' `publishDestinations`. */
export type DestinationsResult = z.infer<typeof destinationsResultSchema>;
/** A file-transfer destination as the destination form saves it: a new one has no id yet. */
declare const destinationDraftSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodUUID>;
    name: z.ZodString;
    settings: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            host: z.ZodPipe<z.ZodString, z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>>;
            port: z.ZodOptional<z.ZodNumber>;
            user: z.ZodString;
            folder: z.ZodString;
            url: z.ZodOptional<z.ZodURL>;
            redirectRules: z.ZodOptional<z.ZodBoolean>;
            protocol: z.ZodEnum<{
              ftp: "ftp";
              ftps: "ftps";
            }>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            host: z.ZodPipe<z.ZodString, z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>>;
            port: z.ZodOptional<z.ZodNumber>;
            user: z.ZodString;
            folder: z.ZodString;
            url: z.ZodOptional<z.ZodURL>;
            redirectRules: z.ZodOptional<z.ZodBoolean>;
            protocol: z.ZodLiteral<"sftp">;
            signIn: z.ZodEnum<{
              key: "key";
              password: "password";
            }>;
          },
          z.core.$strict
        >,
      ],
      "protocol"
    >;
  },
  z.core.$strict
>;
/** See {@link destinationDraftSchema}. */
type DestinationDraft = z.input<typeof destinationDraftSchema>;
/**
 * How a saved destination signs in: as typed, or `keep` to keep the sign-in saved for it, which
 * main allows only while the protocol, host, port, user and host key are those it was saved for.
 */
declare const savedSignInSchema: z.ZodUnion<
  readonly [
    z.ZodUnion<
      readonly [
        z.ZodObject<
          {
            password: z.ZodString;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            keyHandle: z.ZodUUID;
            passphrase: z.ZodOptional<z.ZodString>;
          },
          z.core.$strict
        >,
      ]
    >,
    z.ZodObject<
      {
        keep: z.ZodLiteral<true>;
      },
      z.core.$strict
    >,
  ]
>;
/** See {@link savedSignInSchema}. */
export type SavedSignInRef = z.infer<typeof savedSignInSchema>;
export declare const saveDestinationResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"saved">;
        destination: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                id: z.ZodUUID;
                name: z.ZodString;
                kind: z.ZodLiteral<"file-transfer">;
                settings: z.ZodDiscriminatedUnion<
                  [
                    z.ZodObject<
                      {
                        host: z.ZodPipe<
                          z.ZodString,
                          z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                        >;
                        port: z.ZodOptional<z.ZodNumber>;
                        user: z.ZodString;
                        folder: z.ZodString;
                        url: z.ZodOptional<z.ZodURL>;
                        redirectRules: z.ZodOptional<z.ZodBoolean>;
                        protocol: z.ZodEnum<{
                          ftp: "ftp";
                          ftps: "ftps";
                        }>;
                      },
                      z.core.$strict
                    >,
                    z.ZodObject<
                      {
                        host: z.ZodPipe<
                          z.ZodString,
                          z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                        >;
                        port: z.ZodOptional<z.ZodNumber>;
                        user: z.ZodString;
                        folder: z.ZodString;
                        url: z.ZodOptional<z.ZodURL>;
                        redirectRules: z.ZodOptional<z.ZodBoolean>;
                        protocol: z.ZodLiteral<"sftp">;
                        signIn: z.ZodEnum<{
                          key: "key";
                          password: "password";
                        }>;
                      },
                      z.core.$strict
                    >,
                  ],
                  "protocol"
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                id: z.ZodUUID;
                name: z.ZodString;
                kind: z.ZodLiteral<"netlify">;
                siteId: z.ZodOptional<z.ZodString>;
                url: z.ZodOptional<z.ZodURL>;
              },
              z.core.$strict
            >,
          ],
          "kind"
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"sign-in-needed">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "bad-key": "bad-key";
          full: "full";
          "no-keychain": "no-keychain";
          "no-site": "no-site";
          "read-only": "read-only";
          "stale-session": "stale-session";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** See {@link publishChannels}' `publishSaveDestination`. */
export type SaveDestinationResult = z.infer<typeof saveDestinationResultSchema>;
declare const removeDestinationResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"removed">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "bad-key": "bad-key";
          full: "full";
          "no-keychain": "no-keychain";
          "no-site": "no-site";
          "read-only": "read-only";
          "stale-session": "stale-session";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** See {@link publishChannels}' `publishRemoveDestination`. */
export type RemoveDestinationResult = z.infer<typeof removeDestinationResultSchema>;
declare const testSavedResultSchema: z.ZodUnion<
  readonly [
    z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            ok: z.ZodLiteral<true>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            ok: z.ZodLiteral<false>;
            code: z.ZodEnum<{
              "bad-key": "bad-key";
              cancelled: "cancelled";
              failed: "failed";
              network: "network";
              "no-encryption": "no-encryption";
              "not-found": "not-found";
              "other-site": "other-site";
              "rate-limited": "rate-limited";
              rejected: "rejected";
              timeout: "timeout";
              unauthorized: "unauthorized";
              "untrusted-host": "untrusted-host";
            }>;
          },
          z.core.$strict
        >,
      ],
      "ok"
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "bad-key": "bad-key";
          full: "full";
          "no-keychain": "no-keychain";
          "no-site": "no-site";
          "read-only": "read-only";
          "stale-session": "stale-session";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ]
>;
/** See {@link publishChannels}' `publishTestSavedDestination`. */
type TestSavedResult = z.infer<typeof testSavedResultSchema>;
/** Why a publish failed: what publishing found, or what kept it from starting. */
export declare const PUBLISH_FAILURE_REASONS: readonly [
  ...(
    | "bad-key"
    | "failed"
    | "network"
    | "no-encryption"
    | "not-found"
    | "other-site"
    | "rate-limited"
    | "rejected"
    | "timeout"
    | "unauthorized"
    | "untrusted-host"
  )[],
  "build-failed",
  "reserved-name",
  "unreadable-image",
  "no-site",
  "stale-session",
  "no-destination",
  "no-version",
  "unreadable-version",
  "unknown",
];
/** One of {@link PUBLISH_FAILURE_REASONS}. */
export type PublishFailure = (typeof PUBLISH_FAILURE_REASONS)[number];
/**
 * What became of a publish (4.5, ADR 0018): live at `url` (the live check's result with it, and
 * whether the version it went live with was saved, or a republished one's record of it written:
 * not to a read-only site); refused before anything was built, for `count` *Must fix* findings, or
 * a sign-in not saved for the destination as it is (S2); cancelled; or why it failed, by its code.
 * A republish (4.6b) also fails for a version no longer in the site (`no-version`), or one this
 * Webforge can't read (`unreadable-version`).
 */
declare const publishResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"published">;
        url: z.ZodString;
        check: z.ZodEnum<{
          different: "different";
          live: "live";
          unchecked: "unchecked";
          unreachable: "unreachable";
        }>;
        uploaded: z.ZodInt;
        unchanged: z.ZodInt;
        removed: z.ZodInt;
        restored: z.ZodOptional<z.ZodLiteral<true>>;
        versionSaved: z.ZodBoolean;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"must-fix">;
        count: z.ZodInt;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"sign-in-needed">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"cancelled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "bad-key": "bad-key";
          "build-failed": "build-failed";
          failed: "failed";
          network: "network";
          "no-destination": "no-destination";
          "no-encryption": "no-encryption";
          "no-site": "no-site";
          "no-version": "no-version";
          "not-found": "not-found";
          "other-site": "other-site";
          "rate-limited": "rate-limited";
          rejected: "rejected";
          "reserved-name": "reserved-name";
          "stale-session": "stale-session";
          timeout: "timeout";
          unauthorized: "unauthorized";
          unknown: "unknown";
          "unreadable-image": "unreadable-image";
          "unreadable-version": "unreadable-version";
          "untrusted-host": "untrusted-host";
        }>;
        page: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** What became of a publish. */
export type PublishResult = z.infer<typeof publishResultSchema>;
/** IPC channels of the `publish` domain (`publish:*`). Each one's arguments are checked. */
export declare const publishChannels: {
  /**
   * Test connection (F-PB-1, B5): signs in to the destination with `signIn` and opens its folder.
   * An FTPS destination on a host without FTPS answers `no-encryption`; an SFTP one whose host key
   * isn't trusted yet, `untrusted-host`. Nothing is uploaded, and the secrets are kept nowhere.
   */
  readonly publishTestConnection: {
    readonly channel: "publish:testConnection";
    readonly request: z.ZodTuple<
      [
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                host: z.ZodPipe<
                  z.ZodString,
                  z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                >;
                port: z.ZodOptional<z.ZodNumber>;
                user: z.ZodString;
                folder: z.ZodString;
                url: z.ZodOptional<z.ZodURL>;
                redirectRules: z.ZodOptional<z.ZodBoolean>;
                protocol: z.ZodEnum<{
                  ftp: "ftp";
                  ftps: "ftps";
                }>;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                host: z.ZodPipe<
                  z.ZodString,
                  z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                >;
                port: z.ZodOptional<z.ZodNumber>;
                user: z.ZodString;
                folder: z.ZodString;
                url: z.ZodOptional<z.ZodURL>;
                redirectRules: z.ZodOptional<z.ZodBoolean>;
                protocol: z.ZodLiteral<"sftp">;
                signIn: z.ZodEnum<{
                  key: "key";
                  password: "password";
                }>;
              },
              z.core.$strict
            >,
          ],
          "protocol"
        >,
        z.ZodUnion<
          readonly [
            z.ZodObject<
              {
                password: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                keyHandle: z.ZodUUID;
                passphrase: z.ZodOptional<z.ZodString>;
              },
              z.core.$strict
            >,
          ]
        >,
        z.ZodObject<
          {
            hostKey: z.ZodOptional<z.ZodString>;
            plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            ok: z.ZodLiteral<true>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            ok: z.ZodLiteral<false>;
            code: z.ZodEnum<{
              "bad-key": "bad-key";
              cancelled: "cancelled";
              failed: "failed";
              network: "network";
              "no-encryption": "no-encryption";
              "not-found": "not-found";
              "other-site": "other-site";
              "rate-limited": "rate-limited";
              rejected: "rejected";
              timeout: "timeout";
              unauthorized: "unauthorized";
              "untrusted-host": "untrusted-host";
            }>;
          },
          z.core.$strict
        >,
      ],
      "ok"
    >;
  };
  /** The key an SFTP host presents, without signing in (ADR 0006 §7). */
  readonly publishReadHostKey: {
    readonly channel: "publish:readHostKey";
    readonly request: z.ZodTuple<[z.ZodString, z.ZodOptional<z.ZodNumber>], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"read">;
            hostKey: z.ZodString;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            code: z.ZodEnum<{
              "bad-key": "bad-key";
              cancelled: "cancelled";
              failed: "failed";
              network: "network";
              "no-encryption": "no-encryption";
              "not-found": "not-found";
              "other-site": "other-site";
              "rate-limited": "rate-limited";
              rejected: "rejected";
              timeout: "timeout";
              unauthorized: "unauthorized";
              "untrusted-host": "untrusted-host";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** Asks for a private key file in the system's dialog and reads it. */
  readonly publishChooseKeyFile: {
    readonly channel: "publish:chooseKeyFile";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"chosen">;
            name: z.ZodString;
            encrypted: z.ZodBoolean;
            handle: z.ZodUUID;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"cancelled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "not-a-key": "not-a-key";
              "too-large": "too-large";
              unreadable: "unreadable";
              unsupported: "unsupported";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** The open site's destinations (4.4a), with whether each one's sign-in is saved here. */
  readonly publishDestinations: {
    readonly channel: "publish:destinations";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"listed">;
            destinations: z.ZodArray<
              z.ZodObject<
                {
                  destination: z.ZodDiscriminatedUnion<
                    [
                      z.ZodObject<
                        {
                          id: z.ZodUUID;
                          name: z.ZodString;
                          kind: z.ZodLiteral<"file-transfer">;
                          settings: z.ZodDiscriminatedUnion<
                            [
                              z.ZodObject<
                                {
                                  host: z.ZodPipe<
                                    z.ZodString,
                                    z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                                  >;
                                  port: z.ZodOptional<z.ZodNumber>;
                                  user: z.ZodString;
                                  folder: z.ZodString;
                                  url: z.ZodOptional<z.ZodURL>;
                                  redirectRules: z.ZodOptional<z.ZodBoolean>;
                                  protocol: z.ZodEnum<{
                                    ftp: "ftp";
                                    ftps: "ftps";
                                  }>;
                                },
                                z.core.$strict
                              >,
                              z.ZodObject<
                                {
                                  host: z.ZodPipe<
                                    z.ZodString,
                                    z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                                  >;
                                  port: z.ZodOptional<z.ZodNumber>;
                                  user: z.ZodString;
                                  folder: z.ZodString;
                                  url: z.ZodOptional<z.ZodURL>;
                                  redirectRules: z.ZodOptional<z.ZodBoolean>;
                                  protocol: z.ZodLiteral<"sftp">;
                                  signIn: z.ZodEnum<{
                                    key: "key";
                                    password: "password";
                                  }>;
                                },
                                z.core.$strict
                              >,
                            ],
                            "protocol"
                          >;
                        },
                        z.core.$strict
                      >,
                      z.ZodObject<
                        {
                          id: z.ZodUUID;
                          name: z.ZodString;
                          kind: z.ZodLiteral<"netlify">;
                          siteId: z.ZodOptional<z.ZodString>;
                          url: z.ZodOptional<z.ZodURL>;
                        },
                        z.core.$strict
                      >,
                    ],
                    "kind"
                  >;
                  signIn: z.ZodEnum<{
                    changed: "changed";
                    none: "none";
                    saved: "saved";
                  }>;
                  trust: z.ZodObject<
                    {
                      hostKey: z.ZodOptional<z.ZodString>;
                      plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
                    },
                    z.core.$strict
                  >;
                },
                z.core.$strict
              >
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "bad-key": "bad-key";
              full: "full";
              "no-keychain": "no-keychain";
              "no-site": "no-site";
              "read-only": "read-only";
              "stale-session": "stale-session";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /**
   * Adds a destination to the open site, or changes one: its settings to the site file, its
   * sign-in and trust to this computer's keychain and data (S2), never the site file.
   */
  readonly publishSaveDestination: {
    readonly channel: "publish:saveDestination";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodObject<
          {
            id: z.ZodOptional<z.ZodUUID>;
            name: z.ZodString;
            settings: z.ZodDiscriminatedUnion<
              [
                z.ZodObject<
                  {
                    host: z.ZodPipe<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                    >;
                    port: z.ZodOptional<z.ZodNumber>;
                    user: z.ZodString;
                    folder: z.ZodString;
                    url: z.ZodOptional<z.ZodURL>;
                    redirectRules: z.ZodOptional<z.ZodBoolean>;
                    protocol: z.ZodEnum<{
                      ftp: "ftp";
                      ftps: "ftps";
                    }>;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    host: z.ZodPipe<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                    >;
                    port: z.ZodOptional<z.ZodNumber>;
                    user: z.ZodString;
                    folder: z.ZodString;
                    url: z.ZodOptional<z.ZodURL>;
                    redirectRules: z.ZodOptional<z.ZodBoolean>;
                    protocol: z.ZodLiteral<"sftp">;
                    signIn: z.ZodEnum<{
                      key: "key";
                      password: "password";
                    }>;
                  },
                  z.core.$strict
                >,
              ],
              "protocol"
            >;
          },
          z.core.$strict
        >,
        z.ZodUnion<
          readonly [
            z.ZodUnion<
              readonly [
                z.ZodObject<
                  {
                    password: z.ZodString;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    keyHandle: z.ZodUUID;
                    passphrase: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >,
              ]
            >,
            z.ZodObject<
              {
                keep: z.ZodLiteral<true>;
              },
              z.core.$strict
            >,
          ]
        >,
        z.ZodObject<
          {
            hostKey: z.ZodOptional<z.ZodString>;
            plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"saved">;
            destination: z.ZodDiscriminatedUnion<
              [
                z.ZodObject<
                  {
                    id: z.ZodUUID;
                    name: z.ZodString;
                    kind: z.ZodLiteral<"file-transfer">;
                    settings: z.ZodDiscriminatedUnion<
                      [
                        z.ZodObject<
                          {
                            host: z.ZodPipe<
                              z.ZodString,
                              z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                            >;
                            port: z.ZodOptional<z.ZodNumber>;
                            user: z.ZodString;
                            folder: z.ZodString;
                            url: z.ZodOptional<z.ZodURL>;
                            redirectRules: z.ZodOptional<z.ZodBoolean>;
                            protocol: z.ZodEnum<{
                              ftp: "ftp";
                              ftps: "ftps";
                            }>;
                          },
                          z.core.$strict
                        >,
                        z.ZodObject<
                          {
                            host: z.ZodPipe<
                              z.ZodString,
                              z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                            >;
                            port: z.ZodOptional<z.ZodNumber>;
                            user: z.ZodString;
                            folder: z.ZodString;
                            url: z.ZodOptional<z.ZodURL>;
                            redirectRules: z.ZodOptional<z.ZodBoolean>;
                            protocol: z.ZodLiteral<"sftp">;
                            signIn: z.ZodEnum<{
                              key: "key";
                              password: "password";
                            }>;
                          },
                          z.core.$strict
                        >,
                      ],
                      "protocol"
                    >;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    id: z.ZodUUID;
                    name: z.ZodString;
                    kind: z.ZodLiteral<"netlify">;
                    siteId: z.ZodOptional<z.ZodString>;
                    url: z.ZodOptional<z.ZodURL>;
                  },
                  z.core.$strict
                >,
              ],
              "kind"
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"sign-in-needed">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "bad-key": "bad-key";
              full: "full";
              "no-keychain": "no-keychain";
              "no-site": "no-site";
              "read-only": "read-only";
              "stale-session": "stale-session";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** Removes a destination from the open site, and its sign-in and trust from this computer. */
  readonly publishRemoveDestination: {
    readonly channel: "publish:removeDestination";
    readonly request: z.ZodTuple<[z.ZodUUID, z.ZodUUID], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"removed">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "bad-key": "bad-key";
              full: "full";
              "no-keychain": "no-keychain";
              "no-site": "no-site";
              "read-only": "read-only";
              "stale-session": "stale-session";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /**
   * Test connection for a saved destination being edited, with the sign-in saved for it: only
   * while `settings` and `trust` are what it was saved for (S2), and `unauthorized` otherwise.
   */
  readonly publishTestSavedDestination: {
    readonly channel: "publish:testSavedDestination";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodUUID,
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                host: z.ZodPipe<
                  z.ZodString,
                  z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                >;
                port: z.ZodOptional<z.ZodNumber>;
                user: z.ZodString;
                folder: z.ZodString;
                url: z.ZodOptional<z.ZodURL>;
                redirectRules: z.ZodOptional<z.ZodBoolean>;
                protocol: z.ZodEnum<{
                  ftp: "ftp";
                  ftps: "ftps";
                }>;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                host: z.ZodPipe<
                  z.ZodString,
                  z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                >;
                port: z.ZodOptional<z.ZodNumber>;
                user: z.ZodString;
                folder: z.ZodString;
                url: z.ZodOptional<z.ZodURL>;
                redirectRules: z.ZodOptional<z.ZodBoolean>;
                protocol: z.ZodLiteral<"sftp">;
                signIn: z.ZodEnum<{
                  key: "key";
                  password: "password";
                }>;
              },
              z.core.$strict
            >,
          ],
          "protocol"
        >,
        z.ZodObject<
          {
            hostKey: z.ZodOptional<z.ZodString>;
            plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodUnion<
      readonly [
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                ok: z.ZodLiteral<true>;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                ok: z.ZodLiteral<false>;
                code: z.ZodEnum<{
                  "bad-key": "bad-key";
                  cancelled: "cancelled";
                  failed: "failed";
                  network: "network";
                  "no-encryption": "no-encryption";
                  "not-found": "not-found";
                  "other-site": "other-site";
                  "rate-limited": "rate-limited";
                  rejected: "rejected";
                  timeout: "timeout";
                  unauthorized: "unauthorized";
                  "untrusted-host": "untrusted-host";
                }>;
              },
              z.core.$strict
            >,
          ],
          "ok"
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "bad-key": "bad-key";
              full: "full";
              "no-keychain": "no-keychain";
              "no-site": "no-site";
              "read-only": "read-only";
              "stale-session": "stale-session";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ]
    >;
  };
  /**
   * Publishes the open site to one of its destinations (4.5, ADR 0018): main reads the site from
   * its file as the window has just saved it, gates it, builds and sends it in the export worker,
   * and saves the version it went live with. As `operationId`, for its progress and its cancel;
   * `replaceOtherSite` once the person agreed to replace another site's folder (A8). With
   * `versionId`, it republishes that saved version instead (4.6b, ADR 0018 §3): main reads and
   * gates the version, and records the publish on it rather than saving another.
   */
  readonly publishSite: {
    readonly channel: "publish:publish";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodUUID,
        z.ZodUUID,
        z.ZodObject<
          {
            replaceOtherSite: z.ZodBoolean;
            versionId: z.ZodOptional<z.ZodUUID>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"published">;
            url: z.ZodString;
            check: z.ZodEnum<{
              different: "different";
              live: "live";
              unchecked: "unchecked";
              unreachable: "unreachable";
            }>;
            uploaded: z.ZodInt;
            unchanged: z.ZodInt;
            removed: z.ZodInt;
            restored: z.ZodOptional<z.ZodLiteral<true>>;
            versionSaved: z.ZodBoolean;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"must-fix">;
            count: z.ZodInt;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"sign-in-needed">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"cancelled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "bad-key": "bad-key";
              "build-failed": "build-failed";
              failed: "failed";
              network: "network";
              "no-destination": "no-destination";
              "no-encryption": "no-encryption";
              "no-site": "no-site";
              "no-version": "no-version";
              "not-found": "not-found";
              "other-site": "other-site";
              "rate-limited": "rate-limited";
              rejected: "rejected";
              "reserved-name": "reserved-name";
              "stale-session": "stale-session";
              timeout: "timeout";
              unauthorized: "unauthorized";
              unknown: "unknown";
              "unreadable-image": "unreadable-image";
              "unreadable-version": "unreadable-version";
              "untrusted-host": "untrusted-host";
            }>;
            page: z.ZodOptional<z.ZodString>;
            image: z.ZodOptional<z.ZodString>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** Cancels publish `operationId`: the previous site is left as it was. */
  readonly publishCancel: {
    readonly channel: "publish:cancel";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodNull;
  };
  /**
   * Opens the address publish `operationId` went live at in the default browser: only an address
   * main published to itself, never one from the window. False if there is none, or it couldn't.
   */
  readonly publishOpenLive: {
    readonly channel: "publish:open-live";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodBoolean;
  };
};
/** Events main sends the window about publishing. */
export declare const publishEvents: {
  /** How far publish `operationId` has come. */
  readonly progress: {
    readonly channel: "publish:progress";
    readonly args: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                stage: z.ZodEnum<{
                  images: "images";
                  pages: "pages";
                  uploading: "uploading";
                }>;
                done: z.ZodInt;
                total: z.ZodInt;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                stage: z.ZodEnum<{
                  fonts: "fonts";
                  preparing: "preparing";
                  styles: "styles";
                  verifying: "verifying";
                }>;
              },
              z.core.$strict
            >,
          ],
          "stage"
        >,
      ],
      null
    >;
  };
};
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
  /**
   * Publishes the site `sessionId` opened to destination `destinationId`, as `operationId`; or,
   * with `versionId`, that saved version of it.
   */
  publish(
    sessionId: string,
    destinationId: string,
    operationId: string,
    options: {
      readonly replaceOtherSite: boolean;
      readonly versionId?: string;
    },
  ): Promise<PublishResult>;
  /** Cancels publish `operationId`. */
  cancel(operationId: string): Promise<null>;
  /** Opens the address publish `operationId` went live at; false if it couldn't. */
  openLive(operationId: string): Promise<boolean>;
  /** Calls `listener` with each publish's progress; returns how to stop. */
  onProgress(listener: (operationId: string, progress: PublishProgress) => void): () => void;
  /** Test connection for destination `id` as edited, with the sign-in saved for it. */
  testSavedDestination(
    sessionId: string,
    id: string,
    settings: z.input<typeof fileTransferDestinationSchema>,
    trust: z.input<typeof fileTransferTrustSchema>,
  ): Promise<TestSavedResult>;
}
//# sourceMappingURL=publish.d.ts.map
