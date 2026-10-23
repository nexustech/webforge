/**
 * Which opening of the site this page was loaded for (R6, `ProjectSummary.sessionId`): set when the
 * editor reads the site at start-up, and sent with every call that changes it (saves, the editor
 * mode, imports, the clipboard). The main process refuses a call whose session is no longer the
 * open site's, as when a hand-off (1.8) replaced the site while a save was on its way; the window
 * then reloads with the new site, and this page's module state with it.
 */
let current: string | undefined;

/** A session no site ever has: sent while this page has none (a site in memory only). */
const NO_SESSION = "00000000-0000-0000-0000-000000000000";

/** Remembers the session this page was loaded for; `undefined` for none. */
export function setSiteSession(sessionId: string | undefined): void {
  current = sessionId;
}

/** The session to send with a call that changes the open site. */
export function siteSession(): string {
  return current ?? NO_SESSION;
}
