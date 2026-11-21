import type { EditorUsage } from "../shared/usage.js";

// The editor's side of the usage summary (5.40, BD-1): what it did, sent to main as names from
// fixed lists, which main counts on this computer and never sends anywhere.

/** Sends what the editor did to main: `window.webforge.app.recordUsage`. */
type UsageLog = (usage: EditorUsage) => Promise<unknown>;

let usageLog: UsageLog | undefined;

/** Sends what the editor did to `next` from now on (set once at start-up), or nowhere (tests). */
export function setUsageLog(next: UsageLog | undefined): void {
  usageLog = next;
}

/** Counts `usage` in the usage summary. Counting never fails the caller. */
export function recordUsage(usage: EditorUsage): void {
  usageLog?.(usage).catch(() => undefined);
}
