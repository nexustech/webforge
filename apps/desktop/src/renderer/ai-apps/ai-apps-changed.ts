/**
 * A signal that AI apps may have changed (#1615): AI apps sends it as it closes, after an app was
 * added, removed or connected, and the title bar's sign reads the status again at once instead of
 * waiting for its next look, up to 5 s later (`INDICATOR_EVERY_MS`).
 */
const listeners = new Set<() => void>();

/** Calls `listener` each time AI apps may have changed; gives what stops it. */
export function onAiAppsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Says AI apps may have changed, to everything listening. */
export function aiAppsChanged(): void {
  for (const listener of listeners) listener();
}
