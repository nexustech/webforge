import type { BrowserWindow } from "electron";
import { logFailure } from "./log.js";
import type { PreferencesStore } from "./preferences.js";
import { defaultTimers, type Timers } from "./timers.js";

/** The parts of a `BrowserWindow` remembering its state uses; a fake in tests. */
export type StatefulWindow = Pick<
  BrowserWindow,
  "isDestroyed" | "isMinimized" | "isMaximized" | "isFullScreen" | "getNormalBounds"
> & {
  on(
    event:
      | "maximize"
      | "unmaximize"
      | "enter-full-screen"
      | "leave-full-screen"
      | "resized"
      | "moved"
      | "close",
    listener: () => void,
  ): unknown;
};

/** How long after the last move or resize the window's state is saved. */
const SETTLE_MS = 500;

/**
 * Remembers whether the person keeps the window maximised, and its size and place when not, as
 * they change it and when it closes, so the next start opens it the same way.
 */
export function rememberWindowState(
  window: StatefulWindow,
  preferences: Pick<PreferencesStore, "set">,
  timers: Timers = defaultTimers,
): void {
  let pending: unknown;
  const save = () => {
    timers.clearTimeout(pending);
    pending = undefined;
    if (window.isDestroyed() || window.isMinimized()) {
      return;
    }
    const { x, y, width, height } = window.getNormalBounds();
    const bounds = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
    // Full screen (macOS's green button) counts as maximised.
    const state = { maximized: window.isMaximized() || window.isFullScreen(), bounds };
    preferences.set({ window: state }).catch((error: unknown) => {
      logFailure("Webforge could not remember the window size", error);
    });
  };
  // On macOS "moved" fires all through a drag, so moves and resizes are saved once they stop.
  const saveSoon = () => {
    timers.clearTimeout(pending);
    pending = timers.setTimeout(save, SETTLE_MS);
  };
  window.on("maximize", save);
  window.on("unmaximize", save);
  window.on("enter-full-screen", save);
  window.on("leave-full-screen", save);
  window.on("resized", saveSoon);
  window.on("moved", saveSoon);
  window.on("close", save);
}
