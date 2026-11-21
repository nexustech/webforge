import type { TemplateId } from "@webforge/templates";
import type { AiClientId } from "../shared/ai-clients/index.js";
import type { AssistantErrorCode } from "../shared/ipc/assistant.js";
import type { CommitFailure } from "../shared/ipc/project.js";
import type { PublishFailure } from "../shared/ipc/publish.js";
import type { ExportFailure } from "../shared/ipc/site.js";
import type { EditorUsage } from "../shared/usage.js";

// What the main process counts in the usage summary (5.40, BD-1): each event is one of a fixed
// list, its names from fixed lists, and its sizes numbers. Like `log.ts`, recording goes nowhere
// until the usage feature takes it (`setUsageSink`), so the code that counts needs no wiring and
// a test hears nothing.

/** How a new site was made: empty, from a template, through the quick start, or from a brief. */
export const SITE_STARTS = ["blank", "template", "quickStart", "brief"] as const;

/** Where a site was published to: Netlify, or by file transfer with its protocol. */
export const HOST_KINDS = ["netlify", "ftps", "ftp", "sftp"] as const;

/** What an AI app's request came to (`AiResponse`'s statuses). */
export const AI_OUTCOMES = [
  "done",
  "invalid",
  "not-found",
  "refused",
  "busy",
  "declined",
  "waiting",
] as const;

/** What became of one of the Assistant's tool calls. */
export const ASSISTANT_TOOL_STATES = [
  "done",
  "refused",
  "declined",
  "busy",
  "invalid",
  "failed",
] as const;

/** Why adding files to Media left one out, or failed. */
export const FILE_FAILURES = [
  "unsupported",
  "too-large",
  "not-text",
  "no-site",
  "read-only",
  "unknown",
] as const;

/** How long something took, in ms, and how big the site was: its pages and pictures. */
type Timed = { readonly ms: number; readonly pages: number; readonly pictures: number };

/** One thing the usage summary counts. */
export type UsageEvent =
  | EditorUsage
  | {
      readonly kind: "siteStarted";
      readonly how: (typeof SITE_STARTS)[number];
      readonly template?: TemplateId;
    }
  | { readonly kind: "siteOpened"; readonly ms: number }
  | { readonly kind: "firstEdit" }
  | ({ readonly kind: "preview"; readonly on: "computer" | "phone" } & Timed)
  | { readonly kind: "previewFailed" }
  | ({ readonly kind: "exported" } & Timed)
  | { readonly kind: "exportFailed"; readonly reason: ExportFailure }
  | { readonly kind: "published"; readonly host: (typeof HOST_KINDS)[number] }
  | { readonly kind: "publishFailed"; readonly reason: PublishFailure }
  | { readonly kind: "saveFailed"; readonly reason: CommitFailure }
  | { readonly kind: "filesFailed"; readonly reasons: readonly (typeof FILE_FAILURES)[number][] }
  | {
      readonly kind: "aiApp";
      readonly app: AiClientId;
      readonly tool: string;
      readonly outcome: (typeof AI_OUTCOMES)[number];
    }
  | { readonly kind: "assistant"; readonly outcome: "sending" | AssistantErrorCode }
  | {
      readonly kind: "assistantTool";
      readonly tool: string;
      readonly state: (typeof ASSISTANT_TOOL_STATES)[number];
    }
  | { readonly kind: "startup"; readonly ms: number };

let sink: ((event: UsageEvent) => void) | undefined;

/** Sends what is recorded to `next` from now on (the usage feature), or nowhere. */
export function setUsageSink(next?: (event: UsageEvent) => void): void {
  sink = next;
}

/** Counts `event` in the usage summary. Counting never fails the caller. */
export function recordUsage(event: UsageEvent): void {
  try {
    sink?.(event);
  } catch {
    // The summary is a beta's diagnostics: whatever happens to it, the work goes on.
  }
}
