import { siteAddressSchema } from "@webforge/model";
import { PublishError, type NetlifySite as Site } from "@webforge/publish";
import type { IpcMain } from "electron";
import type { NetlifyAccount, NetlifyFailure, NetlifySite } from "../shared/ipc/netlify.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import type { NetlifySignIns } from "./netlify-auth.js";
import { saveDestination } from "./publish-destinations-ipc.js";
import type { PublishSecrets } from "./publish-secrets.js";
import type { SiteStore, StaleReason } from "./site-store.js";

/** What the Netlify calls are made with; fakes in tests. */
export type NetlifyDeps = {
  /** The sign-ins made and not yet saved for a site (`netlify-auth.ts`). */
  readonly signIns: NetlifySignIns;
  /** The open site as opening `sessionId` reaches it (A13). */
  readonly site: (sessionId: string) => Pick<SiteStore, "withStore">;
  readonly secrets: PublishSecrets;
};

/** A Netlify site's id, as a destination keeps it (`publishDestinationSchema`). */
const SITE_ID = /^[0-9a-f-]{36}$/;

/** `site` as the destination form lists it, or `undefined` for one a destination couldn't keep. */
function listed(site: Site): NetlifySite | undefined {
  if (!SITE_ID.test(site.id)) return undefined;
  const url = siteAddressSchema.safeParse(site.ssl_url ?? undefined);
  return { id: site.id, name: site.name.slice(0, 200), ...(url.success ? { url: url.data } : {}) };
}

/** What a Netlify call that failed tells the person, logged by its code only (never a token). */
function failed(error: unknown, event: string): { status: "failed"; reason: NetlifyFailure } {
  const code = error instanceof PublishError ? error.code : undefined;
  const reason: NetlifyFailure =
    code === "unauthorized" || code === "timeout" || code === "cancelled" || code === "network"
      ? code
      : "failed";
  if (reason === "failed") logFailure(event, error);
  return { status: "failed", reason };
}

/** A sign-in that is held no longer: saved for a site, dropped after 30 minutes, or never made. */
const signedOut = { status: "failed", reason: "signed-out" } as const;

/** Why nothing was done for an opening that no longer has its site. */
const gone = (reason: StaleReason) => ({ status: "failed", reason }) as const;

/**
 * Registers the `netlify` calls (4.2, ADR 0006 decision 4): signing in, through Netlify's OAuth
 * ticket flow in the browser or a pasted token, then listing or creating the site to publish to,
 * and saving the destination with its sign-in for that site (S2, S32). The token never leaves the
 * main process: the renderer has a sign-in's handle only.
 */
export function registerNetlifyHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  deps: NetlifyDeps,
): void {
  const { signIns } = deps;
  /** The sign-ins waiting for the browser, by operation (A14). */
  const signingIn = new Map<string, AbortController>();

  registerIpcHandler(ipc, "netlifyStatus", isTrustedSender, () => ({
    canSignIn: signIns.canSignIn(),
  }));

  registerIpcHandler(ipc, "netlifySignIn", isTrustedSender, async (operationId) => {
    if (!signIns.canSignIn()) return { status: "failed", reason: "not-set-up" } as const;
    if (signingIn.has(operationId)) return { status: "failed", reason: "failed" } as const;
    const controller = new AbortController();
    signingIn.set(operationId, controller);
    try {
      return { status: "signed-in", handle: await signIns.signIn(controller.signal) } as const;
    } catch (error) {
      return failed(error, "Webforge could not sign in to Netlify");
    } finally {
      signingIn.delete(operationId);
    }
  });

  registerIpcHandler(ipc, "netlifyForgetSignIn", isTrustedSender, (handle) => {
    signIns.forget(handle);
    return null;
  });

  registerIpcHandler(ipc, "netlifyCancelSignIn", isTrustedSender, (operationId) => {
    signingIn.get(operationId)?.abort();
    return null;
  });

  registerIpcHandler(ipc, "netlifySignInWithToken", isTrustedSender, async (token) => {
    try {
      return { status: "signed-in", handle: await signIns.signInWithToken(token) } as const;
    } catch (error) {
      return failed(error, "Webforge could not check a Netlify token");
    }
  });

  /**
   * The token saved for the open site's Netlify destination `id`, while the site file names the
   * site it was saved for (S32); `undefined` without one, or once that opening has gone.
   */
  const savedToken = (sessionId: string, id: string) =>
    deps.site(sessionId).withStore<string | undefined>(
      "shared",
      async (store) => {
        const destination = store.readPublishDestinations().find((each) => each.id === id);
        if (destination?.kind !== "netlify") return undefined;
        const saved = await deps.secrets.signInFor(store.info.projectId, destination);
        return saved !== undefined && "token" in saved.signIn ? saved.signIn.token : undefined;
      },
      () => undefined,
    );

  /** Netlify's API as `account` reaches it, or `undefined` for one signed out. */
  const clientOf = async (sessionId: string, account: NetlifyAccount) => {
    if ("handle" in account) return signIns.client(account.handle);
    const token = await savedToken(sessionId, account.saved);
    return token === undefined ? undefined : signIns.clientWith(token);
  };

  registerIpcHandler(ipc, "netlifySites", isTrustedSender, async (sessionId, account) => {
    const client = await clientOf(sessionId, account);
    if (client === undefined) return signedOut;
    try {
      const sites = (await client.listSites()).map(listed).filter((site) => site !== undefined);
      return { status: "listed", sites } as const;
    } catch (error) {
      return failed(error, "Webforge could not list the Netlify sites");
    }
  });

  registerIpcHandler(
    ipc,
    "netlifyCreateSite",
    isTrustedSender,
    async (sessionId, account, name) => {
      const client = await clientOf(sessionId, account);
      if (client === undefined) return signedOut;
      try {
        const site = listed(await client.createSite(name));
        return site === undefined
          ? ({ status: "failed", reason: "failed" } as const)
          : ({ status: "created", site } as const);
      } catch (error) {
        return failed(error, "Webforge could not create a Netlify site");
      }
    },
  );

  registerIpcHandler(ipc, "netlifyTestSaved", isTrustedSender, async (sessionId, id) => {
    // Read with the site, and tested once the gate is free, as file transfer's Test connection is.
    const siteId = await deps.site(sessionId).withStore<string | undefined>(
      "shared",
      (store) => {
        const destination = store.readPublishDestinations().find((each) => each.id === id);
        return destination?.kind === "netlify" ? destination.siteId : undefined;
      },
      () => undefined,
    );
    const client = await clientOf(sessionId, { saved: id });
    if (siteId === undefined || client === undefined) return { ok: false, code: "unauthorized" };
    try {
      await client.getSite(siteId);
      return { ok: true };
    } catch (error) {
      const code = error instanceof PublishError ? error.code : undefined;
      return {
        ok: false,
        code:
          code === "unauthorized" ||
          code === "not-found" ||
          code === "network" ||
          code === "timeout"
            ? code
            : "rejected",
      };
    }
  });

  registerIpcHandler(ipc, "netlifySaveDestination", isTrustedSender, (sessionId, draft, ref) =>
    deps.site(sessionId).withStore(
      "shared",
      async (store) => {
        const saved = await saveDestination(
          store,
          deps.secrets,
          draft.id,
          (id) => ({
            id,
            name: draft.name,
            kind: "netlify",
            siteId: draft.site.id,
            ...(draft.site.url === undefined ? {} : { url: draft.site.url }),
          }),
          async (destination, existing) => {
            // `keep`: the token saved for the destination as the site file names it now (S32),
            // then saved for the site the person chose. A file edited to another site has none.
            const before = existing
              ? store.readPublishDestinations().find((each) => each.id === destination.id)
              : undefined;
            const kept =
              "keep" in ref && before?.kind === "netlify"
                ? await deps.secrets.signInFor(store.info.projectId, before)
                : undefined;
            const token =
              "keep" in ref
                ? kept !== undefined && "token" in kept.signIn
                  ? kept.signIn.token
                  : undefined
                : signIns.token(ref.handle);
            return token === undefined ? ({ status: "sign-in-needed" } as const) : { token };
          },
          {},
        );
        // Held no longer once it's saved; kept, to try again, if it isn't.
        if (saved.status === "saved" && "handle" in ref) signIns.forget(ref.handle);
        return saved;
      },
      gone,
    ),
  );
}
