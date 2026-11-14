import type { UpdateStatus } from "../shared/ipc/updates.js";
import type { UpdateChannel } from "../shared/update-channel.js";
import type { AppFeature } from "./app-feature.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { createUpdateService, type Updater, type UpdateService } from "./updates.js";

/**
 * Webforge's own updates as a feature (0.5a): `updates:status` tells the window the update's state.
 * Installing a downloaded one is quitting's last step (`closeThenExit`'s `install`), not this
 * feature's `quit`, so it never starts while other features are still writing. `service` is looked
 * up as it's called: it starts after the window opens, and never in a build that doesn't update
 * itself, whose state is always `idle`.
 */
export function updatesFeature(service: () => UpdateService | undefined): AppFeature {
  return {
    register: (ipc, isTrustedSender) =>
      registerIpcHandler(
        ipc,
        "updatesStatus",
        isTrustedSender,
        () => service()?.status() ?? { state: "idle" },
      ),
  };
}

/** What Webforge's own updates start with (0.5a): its build, its updater and where it tells. */
export type UpdatesDeps = {
  /** Whether this build updates itself (`updatesSupported`). */
  readonly supported: boolean;
  /** Loads electron-updater, only once the window is open, so it never slows the start. */
  readonly load: () => Promise<Updater>;
  /** The channel the person chose, or the version's (`updateChannelFor`). */
  readonly channel: () => UpdateChannel;
  /** The update's state changed: told to the window. */
  readonly onStatus: (status: UpdateStatus) => void;
  /** Webforge is quitting: no update starts. */
  readonly quitting: () => boolean;
};

/**
 * Webforge's own updates (0.5a, #985): `updates:status`, and the update service, started once the
 * window has opened in a build that updates itself. `service` is the service once it has started.
 */
export function createUpdates(
  deps: UpdatesDeps,
): AppFeature & { readonly service: () => UpdateService | undefined } {
  let service: UpdateService | undefined;
  return {
    ...updatesFeature(() => service),
    service: () => service,
    started() {
      if (!deps.supported) return;
      deps
        .load()
        .then((updater) => {
          if (deps.quitting()) return;
          service = createUpdateService({
            updater,
            channel: deps.channel(),
            onStatus: deps.onStatus,
          });
          service.start();
        })
        .catch((error: unknown) => logFailure("Webforge could not start its updates", error));
    },
  };
}
