import { isMessageKey, t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { TEMPLATE_IMAGE_HASHES } from "@webforge/templates";
import { type AiRequest, type AiResponse, isAppTool } from "../../shared/ipc/ai.js";

/** How long after one Open Preview another opens nothing more, so an app can't flood the browser. */
export const PREVIEW_AGAIN_MS = 10_000;

/** What the window's own tools (`APP_TOOLS`) work with. */
export type AppToolsDeps = {
  /** The open site as it is now. */
  readonly site: () => SiteDoc;
  /** Whether its owner confirmed the addresses its Custom Code allows (#649), as Site Check reads. */
  readonly allowListConfirmed: () => boolean;
  /** Whether the site has a Netlify destination, where its Netlify Forms send (4.2). */
  readonly onNetlify?: (() => boolean) | undefined;
  /** What the person ignored in Site Check for this site. */
  readonly ignored: () => readonly string[];
  /** Runs the window's own Preview command: the local preview, never the phone's. */
  readonly openPreview: () => void;
  readonly now?: () => number;
};

/** A Site Check rule's title, as the panel shows it; its id when there is none. */
const ruleTitle = (rule: string) => {
  const key = `siteCheck.rule.${rule}`;
  return isMessageKey(key) ? t(key) : rule;
};

/**
 * The window's answers to the tools it has itself (4.9): `undefined` for any other request, which
 * the command layer answers. Each takes nothing.
 * - **runSiteCheck:** the export's check, by rule id, title and level, and each finding's place by
 *   id: never a finding's values, which can hold the site's text.
 * - **openPreview:** the Preview command, once in {@link PREVIEW_AGAIN_MS}.
 */
export function createAppTools(deps: AppToolsDeps): (request: AiRequest) => AiResponse | undefined {
  const now = deps.now ?? Date.now;
  let previewedAt = Number.NEGATIVE_INFINITY;
  return (request) => {
    if (request.kind !== "query" || !isAppTool(request.name)) return undefined;
    if (request.name === "runSiteCheck") {
      const report = checkSite(
        {
          site: deps.site(),
          catalogue: CATALOGUE,
          allowListConfirmed: deps.allowListConfirmed(),
          templateImages: TEMPLATE_IMAGE_HASHES,
          ...(deps.onNetlify?.() === true ? { host: "netlify" as const } : {}),
        },
        "export",
        new Set(deps.ignored()),
      );
      return {
        status: "done",
        data: {
          mode: report.mode,
          found: report.results
            .filter((result) => result.findings.length > 0)
            .map((result) => ({
              rule: result.rule,
              title: ruleTitle(result.rule),
              level: result.level,
              places: result.findings.map((finding) => finding.place),
            })),
        },
      };
    }
    const at = now();
    if (at - previewedAt < PREVIEW_AGAIN_MS) {
      return { status: "done", data: { opened: false, reason: "Opened a moment ago." } };
    }
    previewedAt = at;
    deps.openPreview();
    return { status: "done", data: { opened: true } };
  };
}
