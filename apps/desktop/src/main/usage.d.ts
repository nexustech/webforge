import type { TemplateId } from "@webforge/templates";
import type { AiClientId } from "../shared/ai-clients/index.js";
import type { AssistantErrorCode } from "../shared/ipc/assistant.js";
import type { CommitFailure } from "../shared/ipc/project.js";
import type { PublishFailure } from "../shared/ipc/publish.js";
import type { ExportFailure } from "../shared/ipc/site.js";
import type { EditorUsage } from "../shared/usage.js";
/** How a new site was made: empty, from a template, through the quick start, or from a brief. */
export declare const SITE_STARTS: readonly ["blank", "template", "quickStart", "brief"];
/** Where a site was published to: Netlify, or by file transfer with its protocol. */
export declare const HOST_KINDS: readonly ["netlify", "ftps", "ftp", "sftp"];
/** What an AI app's request came to (`AiResponse`'s statuses). */
export declare const AI_OUTCOMES: readonly [
  "done",
  "invalid",
  "not-found",
  "refused",
  "busy",
  "declined",
  "waiting",
];
/** What became of one of the Assistant's tool calls. */
export declare const ASSISTANT_TOOL_STATES: readonly [
  "done",
  "refused",
  "declined",
  "busy",
  "invalid",
  "failed",
];
/** Why adding files to Media left one out, or failed. */
export declare const FILE_FAILURES: readonly [
  "unsupported",
  "too-large",
  "not-text",
  "no-site",
  "read-only",
  "unknown",
];
/** How long something took, in ms, and how big the site was: its pages and pictures. */
type Timed = {
  readonly ms: number;
  readonly pages: number;
  readonly pictures: number;
};
/** One thing the usage summary counts. */
export type UsageEvent =
  | EditorUsage
  | {
      readonly kind: "siteStarted";
      readonly how: (typeof SITE_STARTS)[number];
      readonly template?: TemplateId;
    }
  | {
      readonly kind: "siteOpened";
      readonly ms: number;
    }
  | {
      readonly kind: "firstEdit";
    }
  | ({
      readonly kind: "preview";
      readonly on: "computer" | "phone";
    } & Timed)
  | {
      readonly kind: "previewFailed";
    }
  | ({
      readonly kind: "exported";
    } & Timed)
  | {
      readonly kind: "exportFailed";
      readonly reason: ExportFailure;
    }
  | {
      readonly kind: "published";
      readonly host: (typeof HOST_KINDS)[number];
    }
  | {
      readonly kind: "publishFailed";
      readonly reason: PublishFailure;
    }
  | {
      readonly kind: "saveFailed";
      readonly reason: CommitFailure;
    }
  | {
      readonly kind: "filesFailed";
      readonly reasons: readonly (typeof FILE_FAILURES)[number][];
    }
  | {
      readonly kind: "aiApp";
      readonly app: AiClientId;
      readonly tool: string;
      readonly outcome: (typeof AI_OUTCOMES)[number];
    }
  | {
      readonly kind: "assistant";
      readonly outcome: "sending" | AssistantErrorCode;
    }
  | {
      readonly kind: "assistantTool";
      readonly tool: string;
      readonly state: (typeof ASSISTANT_TOOL_STATES)[number];
    }
  | {
      readonly kind: "startup";
      readonly ms: number;
    };
/** Sends what is recorded to `next` from now on (the usage feature), or nowhere. */
export declare function setUsageSink(next?: (event: UsageEvent) => void): void;
/** Counts `event` in the usage summary. Counting never fails the caller. */
export declare function recordUsage(event: UsageEvent): void;
//# sourceMappingURL=usage.d.ts.map
