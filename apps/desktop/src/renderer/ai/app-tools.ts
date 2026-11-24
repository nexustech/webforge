import { APP_PARSE } from "@webforge/commands";
import { isMessageKey, t } from "@webforge/i18n";
import {
  type FormUnset,
  type ImageMeta,
  mediaItem,
  parseColorRef,
  type SiteDoc,
} from "@webforge/model";
import { checkSite } from "@webforge/site-check";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { TEMPLATE_IMAGE_HASHES } from "@webforge/templates";
import { hexOf, imageColours, oklchCss } from "@webforge/themes";
import { z } from "zod";
import { pictureColoursInput } from "../../shared/ai-tools.js";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";

/** How long after one Open Preview another opens nothing more, so an app can't flood the browser. */
export const PREVIEW_AGAIN_MS = 10_000;

/** What Run Site Check and Open Preview work with. */
export type AppToolsDeps = {
  /**
   * The open site as it is now; for a held reply's request (6.9e), its stage's id, and the draft
   * its changes are on (5.18).
   */
  readonly site: (stage?: string) => SiteDoc;
  /** Whether its owner confirmed the addresses its Custom Code allows (#649), as Site Check reads. */
  readonly allowListConfirmed: () => boolean;
  /** Whether the site has a Netlify destination, where its Netlify Forms send (4.2). */
  readonly onNetlify?: (() => boolean) | undefined;
  /** What the person ignored in Site Check for this site. */
  readonly ignored: () => readonly string[];
  /**
   * Runs the window's own Preview command: the local preview, never the phone's. Resolves with the
   * address of the page it opened (#1255), or `null` if it didn't open.
   */
  readonly openPreview: () => Promise<string | null>;
  /** The pixels (RGBA) of a small copy of Media picture `item`, as Theme Studio reads them. */
  readonly readPixels: (item: ImageMeta) => Promise<ArrayLike<number>>;
  readonly now?: () => number;
};

/** One of a picture's main colours, as an AI app is told it (#1373). */
type PictureColour = { readonly oklch: string; readonly hex: string; readonly share: number };

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

/**
 * Opens the preview and resolves with the address of the page it opened (#1255): main is asked for
 * the next address (`next`) before the Preview command runs (`run`), so the open it starts is the
 * one told; a command that can't run tells main at once that no open follows (`cancel`).
 */
export function openPreviewFor(preview: {
  readonly next: () => Promise<string | null>;
  readonly run: () => boolean;
  readonly cancel: () => Promise<unknown>;
}): Promise<string | null> {
  const next = preview.next();
  if (!preview.run()) void preview.cancel().catch(() => undefined);
  return next.catch(() => null);
}

/** A Site Check rule's title, as the panel shows it; its id when there is none. */
const ruleTitle = (rule: string) => {
  const key = `siteCheck.rule.${rule}`;
  return isMessageKey(key) ? t(key) : rule;
};

/**
 * The window's answers to three of the tools it has itself (4.9, `WINDOW_TOOLS`).
 * - **runSiteCheck:** the export's check, by rule id, title and level, and each finding's place by
 *   id, with its facts (#1253): numbers and listed names, such as a contrast finding's colours and
 *   ratios. Never a value that can hold the site's text ({@link factsOf}). A held reply's (6.9e)
 *   checks its draft, so what it reports is what its changes would leave (5.18).
 * - **openPreview:** the Preview command, once in {@link PREVIEW_AGAIN_MS}, with the address of the
 *   page it opened (#1255): on this computer only, for the app to look at its work.
 * - **pictureColours:** a Media picture's main colours (#1373), from a small copy of it read here,
 *   as Theme Studio's palette from an image reads them: in OKLCH and hex, with their shares. The
 *   app never sees the picture.
 */
export function createAppTools(deps: AppToolsDeps): {
  readonly runSiteCheck: (request?: Pick<AiRequest, "stage">) => AiResponse;
  readonly openPreview: () => AiResponse | Promise<AiResponse>;
  readonly pictureColours: (request: AiRequest) => Promise<AiResponse>;
} {
  const now = deps.now ?? Date.now;
  let previewedAt = Number.NEGATIVE_INFINITY;
  /** Each picture's colours, by its bytes' hash: the same picture is read once (#1373). */
  const read = new Map<string, Promise<readonly PictureColour[]>>();
  const coloursOf = (item: ImageMeta) => {
    let colours = read.get(item.hash);
    if (colours === undefined) {
      colours = deps.readPixels(item).then((pixels) =>
        imageColours(pixels).map(({ color, share }) => ({
          oklch: oklchCss(color),
          hex: hexOf(color),
          share: Number(share.toFixed(3)),
        })),
      );
      read.set(item.hash, colours);
      // One that couldn't be read is tried again next time.
      colours.catch(() => read.delete(item.hash));
    }
    return colours;
  };
  return {
    pictureColours: async (request) => {
      const parsed = pictureColoursInput.safeParse(request.input, APP_PARSE);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const { mediaId } = parsed.data;
      const item = mediaItem(deps.site(request.stage).media, mediaId);
      if (item === undefined) {
        return {
          status: "not-found",
          message: `There is no "${mediaId}" in Media. The media query lists what there is.`,
        };
      }
      if (item.kind !== "image") {
        return { status: "invalid", message: `"${mediaId}" is a file, not a picture.` };
      }
      try {
        return { status: "done", data: { mediaId, colours: await coloursOf(item) } };
      } catch {
        return { status: "refused", message: `"${mediaId}" couldn't be read for its colours.` };
      }
    },
    runSiteCheck: (request) => {
      const report = checkSite(
        {
          site: deps.site(request?.stage),
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
      // The page's address on this computer, for the app to look at its work (#1255).
      return deps.openPreview().then(
        (address): AiResponse =>
          address === null
            ? { status: "done", data: { opened: false, reason: "The preview didn't open." } }
            : { status: "done", data: { opened: true, address } },
        (): AiResponse => ({
          status: "done",
          data: { opened: false, reason: "The preview didn't open." },
        }),
      );
    },
  };
}
