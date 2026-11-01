import type { IpcMain } from "electron";
import type { ProjectSessionEvents } from "./project-session.js";

/**
 * A feature of the app (A12): the IPC calls it handles, what it does as a site opens, is saved and
 * closes, and its last work before Webforge exits. `startApp` makes each one and wires all of them
 * the same way, so what a feature must stop when its site closes, or finish before Webforge exits,
 * is said where the feature is, not in three places of `app.ts`.
 */
export type AppFeature = {
  /** Registers its IPC handlers, once Electron is ready. */
  register?(ipc: Pick<IpcMain, "handle">, isTrustedSender: (senderUrl: string) => boolean): void;
  /**
   * What it does as sites open, are saved and close, a site a hand-off replaced included. Told in
   * the order the features are listed; one that throws is logged, and the others are still told.
   */
  readonly site?: ProjectSessionEvents;
  /** Its last work, awaited once the site has closed and before Webforge exits. */
  quit?(): Promise<void>;
};
