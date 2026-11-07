import { createHash, timingSafeEqual } from "node:crypto";
import { logFailure } from "./log.js";

/** How long a copied secret stays on the clipboard before it's cleared, as password managers do. */
export const SECRET_CLEARED_AFTER_MS = 60_000;

/**
 * Windows' formats that keep a copy out of clipboard history (Win+V), cloud clipboard and
 * clipboard monitors, written beside the text. Each holds a DWORD 0; the first needs only to be
 * there. Electron writes a raw format through its `osclipboard` type, with the name quoted.
 */
const WINDOWS_PRIVATE_FORMATS = [
  "ExcludeClipboardContentFromMonitorProcessing",
  "CanIncludeInClipboardHistory",
  "CanUploadToCloudClipboard",
].map((format) => `electron application/osclipboard;format="${format}"`);

/** The system clipboard, as a copied secret uses it. */
export type SecretClipboardSystem = {
  /** Replaces the clipboard's content with `text`, kept out of clipboard history where it can be. */
  writePrivate(text: string): Promise<void>;
  readText(): Promise<string>;
  clear(): void;
};

/** Electron's clipboard as a {@link SecretClipboardSystem} on `platform`. */
export function electronSecretClipboard(
  electron: Pick<typeof import("electron"), "clipboard" | "ClipboardItem">,
  platform: NodeJS.Platform,
): SecretClipboardSystem {
  const { clipboard, ClipboardItem } = electron;
  const privateFormats = platform === "win32" ? WINDOWS_PRIVATE_FORMATS : [];
  return {
    writePrivate: (text) =>
      // One write, so the text is never on the clipboard without the formats beside it.
      clipboard.write([
        new ClipboardItem({
          "text/plain": text,
          ...Object.fromEntries(
            privateFormats.map((format) => [format, new Blob([new Uint8Array(4)])]),
          ),
        }),
      ]),
    readText: () => clipboard.readText(),
    clear: () => clipboard.clear(),
  };
}

const digest = (text: string) => createHash("sha256").update(text).digest();

/** Timers, as the clearing uses them: replaced in tests. */
type Timers = {
  set(run: () => void, ms: number): unknown;
  cancel(timer: unknown): void;
};

const realTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms).unref(),
  cancel: (timer) => clearTimeout(timer as NodeJS.Timeout),
};

/**
 * Copies secrets, an AI app's key (4.9): kept out of clipboard history, and cleared after
 * {@link SECRET_CLEARED_AFTER_MS} or when Webforge quits, if the clipboard still holds it. Only a
 * hash of the secret is kept meanwhile, to tell whether it's still there.
 */
export function createSecretClipboard(system: SecretClipboardSystem, timers: Timers = realTimers) {
  let held: { readonly hash: Buffer; readonly timer: unknown } | undefined;

  /** Clears the clipboard if it still holds the last secret copied; else leaves it be. */
  async function clearIfHeld(): Promise<void> {
    const last = held;
    if (last === undefined) return;
    held = undefined;
    timers.cancel(last.timer);
    const now = digest(await system.readText());
    if (timingSafeEqual(now, last.hash)) system.clear();
  }

  return {
    /** Puts `secret` on the clipboard, to be cleared in a minute. */
    async copy(secret: string): Promise<void> {
      if (held !== undefined) timers.cancel(held.timer);
      held = undefined;
      await system.writePrivate(secret);
      held = {
        hash: digest(secret),
        timer: timers.set(
          () =>
            void clearIfHeld().catch((error: unknown) =>
              logFailure("secret clipboard clear", error),
            ),
          SECRET_CLEARED_AFTER_MS,
        ),
      };
    },
    /** Clears a secret still on the clipboard now: Webforge is quitting. */
    clearIfHeld,
  };
}
