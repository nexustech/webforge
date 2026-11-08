import { randomUUID } from "node:crypto";
import {
  type FileTransferDestination,
  type FileTransferSignIn,
  type FileTransferTrust,
  PUBLISH_DESTINATIONS_MAX,
  type PublishDestination,
} from "@webforge/model";
import type { PublishSignIn } from "@webforge/publish";
import type { ProjectStore } from "@webforge/storage";
import type { IpcMain } from "electron";
import type {
  ConnectionResult,
  DestinationsResult,
  RemoveDestinationResult,
  SaveDestinationResult,
} from "../shared/ipc/publish.js";
import type { AppFeature } from "./app-feature.js";
import { CredentialError } from "./credential-store.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { type KeyFiles, signInOf } from "./publish-ipc.js";
import type { PublishSecrets } from "./publish-secrets.js";
import { type SiteStore, type StaleReason, storeFailure } from "./site-store.js";

/** What the destinations' calls are made with; fakes in tests. */
export type DestinationsDeps = {
  /** The open site as opening `sessionId` reaches it (A13). */
  readonly site: (sessionId: string) => Pick<SiteStore, "withStore">;
  readonly secrets: PublishSecrets;
  /** The key files the person chose, by handle: the same ones Test connection reads. */
  readonly keys: Pick<KeyFiles, "get">;
  /** Test connection with a sign-in main holds (4.3's, `publish-ipc.ts`). */
  readonly test: (
    destination: FileTransferDestination,
    signIn: FileTransferSignIn,
    trust: FileTransferTrust,
  ) => Promise<ConnectionResult>;
};

/** Why nothing was done for an opening that no longer has its site. */
const gone = (reason: StaleReason) => ({ status: "failed", reason }) as const;

/** A failure, logged as `event` by its code only, never with a secret or the site's content. */
function failure(error: unknown, event: string) {
  if (error instanceof CredentialError && error.code === "encryption-unavailable") {
    return { status: "failed", reason: "no-keychain" } as const;
  }
  return storeFailure(error, event);
}

/**
 * Registers the calls about the open site's publish destinations (4.4a, ADR 0018 §2): the list in
 * the site file's `meta`, each one's sign-in and trust in this computer's keychain under the
 * site's project id (S2). Only for the site open now (R6), as each call names its opening.
 */
export function registerDestinationHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  deps: DestinationsDeps,
): void {
  const { secrets } = deps;

  registerIpcHandler(ipc, "publishDestinations", isTrustedSender, (sessionId) =>
    deps.site(sessionId).withStore<DestinationsResult>(
      "shared",
      async (store) => {
        const { projectId } = store.info;
        const listed = store.readPublishDestinations().map(async (destination) => ({
          destination,
          ...(await secrets.state(projectId, destination)),
        }));
        return { status: "listed", destinations: await Promise.all(listed) } as const;
      },
      gone,
    ),
  );

  registerIpcHandler(
    ipc,
    "publishSaveDestination",
    isTrustedSender,
    (sessionId, draft, ref, trust) =>
      deps.site(sessionId).withStore<SaveDestinationResult>(
        "shared",
        (store) =>
          saveDestination(
            store,
            secrets,
            draft.id,
            (id) => ({ id, name: draft.name, kind: "file-transfer", settings: draft.settings }),
            async (destination, existing) => {
              // Kept only for the destination it was typed for, as it still is (S2).
              const signIn =
                "keep" in ref
                  ? existing
                    ? (await secrets.signInFor(store.info.projectId, destination, trust))?.signIn
                    : undefined
                  : signInOf(ref, deps.keys);
              if (signIn !== undefined) return signIn;
              return "keep" in ref
                ? ({ status: "sign-in-needed" } as const)
                : ({ status: "failed", reason: "bad-key" } as const);
            },
            trust,
          ),
        gone,
      ),
  );

  registerIpcHandler(ipc, "publishRemoveDestination", isTrustedSender, (sessionId, id) =>
    deps.site(sessionId).withStore<RemoveDestinationResult>(
      "shared",
      async (store) => {
        const before = store.readPublishDestinations();
        try {
          store.writePublishDestinations(before.filter((each) => each.id !== id));
        } catch (error) {
          return failure(error, "Webforge could not remove a publish destination");
        }
        try {
          await secrets.remove(store.info.projectId, id);
        } catch (error) {
          // The destination has gone: its sign-in can't be given to anything now.
          logFailure("Webforge could not forget a publish destination's sign-in", error);
        }
        return { status: "removed" } as const;
      },
      gone,
    ),
  );

  registerIpcHandler(
    ipc,
    "publishTestSavedDestination",
    isTrustedSender,
    async (sessionId, id, settings, trust) => {
      // Read with the site, and tested once the gate is free: a test may take a while.
      const found = await deps
        .site(sessionId)
        .withStore<PublishSignIn | ReturnType<typeof gone> | undefined>(
          "shared",
          async (store) => {
            const existing = store.readPublishDestinations().find((each) => each.id === id);
            if (existing === undefined) return undefined;
            const destination: PublishDestination = {
              ...existing,
              kind: "file-transfer",
              settings,
            };
            return (await secrets.signInFor(store.info.projectId, destination, trust))?.signIn;
          },
          gone,
        );
      if (found !== undefined && "status" in found) return found;
      if (found === undefined || "token" in found) return { ok: false, code: "unauthorized" };
      return deps.test(settings, found, trust);
    },
  );
}

/** What a destination's save reads and writes of the open site's file. */
type DestinationsStore = Pick<
  ProjectStore,
  "info" | "readPublishDestinations" | "writePublishDestinations"
>;

/**
 * Saves the destination `make` gives for its id (`id` for one already in the list, a new one
 * without) in the open site's list, with the sign-in `signInFor` gives for it as it will be saved,
 * in this computer's keychain (4.4a, S2): a file-transfer destination's (`publishSaveDestination`)
 * and a Netlify one's (`netlifySaveDestination`, 4.2). `signInFor` answers what to tell the
 * renderer instead when there's no sign-in to save; `existing`: whether it's in the list already.
 * The list first, so a read-only site leaves the saved sign-in as it was; the sign-in next, and
 * the list back as it was if that fails.
 */
export async function saveDestination(
  store: DestinationsStore,
  secrets: PublishSecrets,
  id: string | undefined,
  make: (id: string) => PublishDestination,
  signInFor: (
    destination: PublishDestination,
    existing: boolean,
  ) => Promise<PublishSignIn | Exclude<SaveDestinationResult, { status: "saved" }>>,
  trust: FileTransferTrust,
): Promise<SaveDestinationResult> {
  const before = store.readPublishDestinations();
  const existing = before.find((each) => each.id === id);
  if (id !== undefined && existing === undefined) {
    // Removed meanwhile, in another window of this site's or by a hand-off.
    return { status: "failed", reason: "unknown" };
  }
  if (existing === undefined && before.length >= PUBLISH_DESTINATIONS_MAX) {
    return { status: "failed", reason: "full" };
  }
  const destination = make(existing?.id ?? randomUUID());
  const signIn = await signInFor(destination, existing !== undefined);
  if ("status" in signIn) return signIn;
  const after =
    existing === undefined
      ? [...before, destination]
      : before.map((each) => (each.id === destination.id ? destination : each));
  try {
    store.writePublishDestinations(after);
  } catch (error) {
    return failure(error, "Webforge could not save a publish destination");
  }
  try {
    await secrets.save(store.info.projectId, destination, signIn, trust);
  } catch (error) {
    try {
      store.writePublishDestinations(before);
    } catch (undo) {
      logFailure("Webforge could not put the publish destinations back", undo);
    }
    return failure(error, "Webforge could not save a publish destination's sign-in");
  }
  return { status: "saved", destination };
}

/** The destinations' calls as a feature of the app (A12). */
export function publishDestinationsFeature(deps: DestinationsDeps): AppFeature {
  return {
    register: (ipc, isTrustedSender) => registerDestinationHandlers(ipc, isTrustedSender, deps),
  };
}
