import { DESTINATION_NAME_MAX, SECRET_MAX, siteAddressSchema } from "@webforge/model";
import { z } from "zod";
import { sessionIdSchema } from "./project.js";
import { type SaveDestinationResult, saveDestinationResultSchema } from "./publish.js";

// Netlify sign-in and sites for publish destinations (4.2, ADR 0006 decision 4): what 4.4b's
// *Add destination › Netlify* asks the main process for. The token stays in main: the renderer
// holds only a sign-in's handle, until the destination is saved with its site (S2, S32).

/** Whether Netlify's own sign-in can be offered: the build has Webforge's OAuth client ID. */
const statusSchema = z.strictObject({ canSignIn: z.boolean() });

/** See {@link netlifyChannels}' `netlifyStatus`. */
export type NetlifyStatus = z.infer<typeof statusSchema>;

/** A sign-in held in the main process, until it's saved for a site or dropped (30 minutes). */
const handleSchema = z.uuid();

/** Why a Netlify call did nothing, for the person to be told. */
const failureSchema = z.strictObject({
  status: z.literal("failed"),
  reason: z.enum([
    // This build has no OAuth client ID: only a pasted token works.
    "not-set-up",
    // Netlify refused the token, or the sign-in was turned down.
    "unauthorized",
    // The sign-in wasn't approved in the browser in time, or Netlify took too long.
    "timeout",
    "cancelled",
    "network",
    // A sign-in that has been saved for a site, or dropped: sign in again.
    "signed-out",
    "failed",
  ]),
});

/** Why a Netlify call did nothing. */
export type NetlifyFailure = z.infer<typeof failureSchema>["reason"];

const signInResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("signed-in"), handle: handleSchema }),
  failureSchema,
]);

/** See {@link netlifyChannels}' `netlifySignIn` and `netlifySignInWithToken`. */
export type NetlifySignInResult = z.infer<typeof signInResultSchema>;

/** A Netlify site the person can publish to, as the destination form lists it. */
const netlifySiteSchema = z.strictObject({
  /** Netlify's id of the site, which the destination keeps (and its sign-in is tied to, S32). */
  id: z.string().regex(/^[0-9a-f-]{36}$/),
  name: z.string().max(200),
  /** The address Netlify serves it at; none for a site that has never been published. */
  url: siteAddressSchema.optional(),
});

/** A Netlify site. */
export type NetlifySite = z.infer<typeof netlifySiteSchema>;

const sitesResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("listed"), sites: z.array(netlifySiteSchema) }),
  failureSchema,
]);

/** See {@link netlifyChannels}' `netlifySites`. */
export type NetlifySitesResult = z.infer<typeof sitesResultSchema>;

const createSiteResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("created"), site: netlifySiteSchema }),
  failureSchema,
]);

/** See {@link netlifyChannels}' `netlifyCreateSite`. */
export type NetlifyCreateSiteResult = z.infer<typeof createSiteResultSchema>;

/** A Netlify destination as the destination form saves it: a new one has no id yet. */
const netlifyDraftSchema = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(DESTINATION_NAME_MAX),
  site: netlifySiteSchema,
});

/** See {@link netlifyDraftSchema}. */
export type NetlifyDraft = z.input<typeof netlifyDraftSchema>;

/**
 * How a saved Netlify destination signs in: a sign-in's `handle`, or `keep` to keep the one saved
 * for it, which main allows only while the destination's site is the one it was saved for (S32).
 */
const netlifySignInRefSchema = z.union([
  z.strictObject({ handle: handleSchema }),
  z.strictObject({ keep: z.literal(true) }),
]);

/** See {@link netlifySignInRefSchema}. */
export type NetlifySignInRef = z.infer<typeof netlifySignInRefSchema>;

/** A long-running sign-in in the browser, named so it can be cancelled (A14). */
const operationIdSchema = z.uuid();

/** IPC channels of the `netlify` domain (`netlify:*`). Each one's arguments are checked. */
export const netlifyChannels = {
  /** Whether Netlify's own sign-in can be offered, or only a pasted token. */
  netlifyStatus: {
    channel: "netlify:status",
    request: z.tuple([]),
    response: statusSchema,
  },
  /**
   * Signs in in the person's browser (Netlify's OAuth ticket flow): up to 5 minutes for them to
   * approve. The sign-in is held in main under its handle.
   */
  netlifySignIn: {
    channel: "netlify:sign-in",
    request: z.tuple([operationIdSchema]),
    response: signInResultSchema,
  },
  /** Stops sign-in `operationId` waiting for the browser; it answers `cancelled`. */
  netlifyCancelSignIn: {
    channel: "netlify:cancel-sign-in",
    request: z.tuple([operationIdSchema]),
    response: z.null(),
  },
  /** Checks a pasted personal access token with Netlify, and holds it as a sign-in. */
  netlifySignInWithToken: {
    channel: "netlify:sign-in-with-token",
    request: z.tuple([z.string().min(1).max(SECRET_MAX)]),
    response: signInResultSchema,
  },
  /** The Netlify sites sign-in `handle` can publish to. */
  netlifySites: {
    channel: "netlify:sites",
    request: z.tuple([handleSchema]),
    response: sitesResultSchema,
  },
  /** Creates a Netlify site for sign-in `handle`, named `name` if it's free (else Netlify's). */
  netlifyCreateSite: {
    channel: "netlify:create-site",
    request: z.tuple([handleSchema, z.string().trim().min(1).max(63).optional()]),
    response: createSiteResultSchema,
  },
  /**
   * Saves a Netlify destination in the open site's list, with its sign-in for its site in this
   * computer's keychain (S2, S32): a sign-in's handle, which is then held no longer, or `keep`.
   */
  netlifySaveDestination: {
    channel: "netlify:save-destination",
    request: z.tuple([sessionIdSchema, netlifyDraftSchema, netlifySignInRefSchema]),
    response: saveDestinationResultSchema,
  },
} as const;

/** `window.webforge.netlify`. */
export interface NetlifyApi {
  /** Whether Netlify's own sign-in can be offered, or only a pasted token. */
  status(): Promise<NetlifyStatus>;
  /** Signs in in the person's browser; `operationId` names it for {@link cancelSignIn}. */
  signIn(operationId: string): Promise<NetlifySignInResult>;
  cancelSignIn(operationId: string): Promise<null>;
  /** Checks a pasted personal access token, and holds it as a sign-in. */
  signInWithToken(token: string): Promise<NetlifySignInResult>;
  sites(handle: string): Promise<NetlifySitesResult>;
  createSite(handle: string, name?: string): Promise<NetlifyCreateSiteResult>;
  /** Saves a Netlify destination of the open site's, its sign-in for its site. */
  saveDestination(
    sessionId: string,
    draft: NetlifyDraft,
    signIn: NetlifySignInRef,
  ): Promise<SaveDestinationResult>;
}
