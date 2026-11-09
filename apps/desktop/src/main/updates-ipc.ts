import type { AppFeature } from "./app-feature.js";
import { registerIpcHandler } from "./ipc.js";
import type { UpdateService } from "./updates.js";

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
