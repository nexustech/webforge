import { isMessageKey, t } from "@webforge/i18n";
import { type FormUnset, parseColorRef, type SiteDoc } from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { TEMPLATE_IMAGE_HASHES } from "@webforge/templates";
import type { AiResponse } from "../../shared/ipc/ai.js";

/** How long after one Open Preview another opens nothing more, so an app can't flood the browser. */
export const PREVIEW_AGAIN_MS = 10_000;

/** What Run Site Check and Open Preview work with. */
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

/** A string fact that is one of `names`. */
const oneOf =
  (...names: readonly string[]) =>
  (value: string) =>
    names.includes(value);

/** Why a form can't send, as Site Check says it (`@webforge/model`'s `FormUnset`). */
const FORM_UNSET: readonly FormUnset[] = ["noService", "netlify", "insecure", "noAddress"];

/**
 * The strings a finding's values may pass on to an AI app as facts (#1253), by key, each checked to
 * be one of a fixed list's names, a colour reference or an id: never a name, a title, an address, a
 * selector, a note or any other text the site holds. Numbers (a ratio, a size, a count, a year)
 * pass for any key.
 */
const STRING_FACTS: Readonly<Record<string, (value: string) => boolean>> = {
  // Colour contrast: which colours, in which palette, and one that reads on a gradient.
  palette: oneOf("colors", "inverse"),
  background: (value) => parseColorRef(value) !== undefined,
  foreground: (value) => parseColorRef(value) !== undefined,
  suggested: (value) => parseColorRef(value) !== undefined,
  drawn: oneOf("graphic"),
  on: oneOf("gradient"),
  // An outside file's kind, and why a form can't send.
  kind: oneOf("script", "style", "font", "image", "media", "frame", "other"),
  form: oneOf("service", "newsletter"),
  reason: oneOf(...FORM_UNSET),
  // The page or Media item a finding points to, by id.
  pageId: (value) => /^[A-Za-z0-9_-]{1,64}$/.test(value),
  mediaId: (value) => /^[A-Za-z0-9_-]{1,64}$/.test(value),
};

/** What of a finding's `values` an AI app may have: its facts, never the site's text. */
function factsOf(
  values: Readonly<Record<string, string | number>> | undefined,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values ?? {}).filter(([key, value]) =>
      typeof value === "number"
        ? Number.isFinite(value)
        : Object.hasOwn(STRING_FACTS, key) && (STRING_FACTS[key]?.(value) ?? false),
    ),
  );
}

/** A Site Check rule's title, as the panel shows it; its id when there is none. */
const ruleTitle = (rule: string) => {
  const key = `siteCheck.rule.${rule}`;
  return isMessageKey(key) ? t(key) : rule;
};

/**
 * The window's answers to two of the tools it has itself (4.9, `WINDOW_TOOLS`), each taking
 * nothing.
 * - **runSiteCheck:** the export's check, by rule id, title and level, and each finding's place by
 *   id, with its facts (#1253): numbers and listed names, such as a contrast finding's colours and
 *   ratios. Never a value that can hold the site's text ({@link factsOf}).
 * - **openPreview:** the Preview command, once in {@link PREVIEW_AGAIN_MS}.
 */
export function createAppTools(deps: AppToolsDeps): {
  readonly runSiteCheck: () => AiResponse;
  readonly openPreview: () => AiResponse;
} {
  const now = deps.now ?? Date.now;
  let previewedAt = Number.NEGATIVE_INFINITY;
  return {
    runSiteCheck: () => {
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
            .map((result) => {
              const facts = result.findings.map((finding) => factsOf(finding.values));
              return {
                rule: result.rule,
                title: ruleTitle(result.rule),
                level: result.level,
                places: result.findings.map((finding) => finding.place),
                // Each finding's facts, by its place's position, when any finding has some.
                ...(facts.some((each) => Object.keys(each).length > 0) ? { facts } : {}),
              };
            }),
        },
      };
    },
    openPreview: () => {
      const at = now();
      if (at - previewedAt < PREVIEW_AGAIN_MS) {
        return { status: "done", data: { opened: false, reason: "Opened a moment ago." } };
      }
      previewedAt = at;
      deps.openPreview();
      return { status: "done", data: { opened: true } };
    },
  };
}
