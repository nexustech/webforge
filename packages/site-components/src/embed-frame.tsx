import { t } from "@webforge/i18n";
import type { Embed } from "./embed.js";
import { BUTTON_CLASSES } from "./typography.js";

/** What an embed shows: a video, or a map. */
export type EmbedKind = "video" | "map";

/** The frame's shape: a video's 16:9, a map's taller box. */
const FRAME_CLASSES: Readonly<Record<EmbedKind, string>> = {
  video: "aspect-video",
  map: "h-80 md:h-96",
};

const PLAY_ICON = "M7 4v16l13-8z";
const MAP_ICON = "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14";

/**
 * A video or map from another site, loaded only when the visitor asks (F-CM-4, B7, C8): until
 * then a placeholder, so the page makes no request to YouTube, Vimeo or a map service. The
 * `embed` behaviour shows its button, which puts the player or map in its place; the notice says
 * where it comes from. Without JavaScript, or before the visitor clicks, the link opens it on the
 * provider's own site. On the canvas, where scripts don't run, only the placeholder shows.
 * Shared by the Video and Map sections and 2.11's embed elements.
 */
export function EmbedFrame({
  embed,
  kind,
  title,
}: {
  readonly embed: Embed;
  readonly kind: EmbedKind;
  /** What the loaded `<iframe>` is called for screen readers: the video's or the place's name. */
  readonly title: string;
}) {
  const provider = t(`siteText.embed.provider.${embed.provider}`);
  return (
    <div
      className={`site-embed relative w-full overflow-hidden rounded-box bg-base-300 text-base-content ${FRAME_CLASSES[kind]}`}
      data-wf-embed=""
      data-src={embed.src}
      data-title={title}
    >
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
        data-wf-embed-placeholder=""
      >
        {/* Shown by the script, which makes it work. */}
        <div className="flex flex-col items-center gap-2" data-wf-embed-controls="" hidden>
          <button type="button" className={BUTTON_CLASSES.primary} data-wf-embed-load="">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={kind === "video" ? PLAY_ICON : MAP_ICON} />
            </svg>
            {kind === "video"
              ? t("siteText.embed.playVideo", { provider })
              : t("siteText.embed.showMap", { provider })}
          </button>
          <p className="max-w-sm text-sm">{t("siteText.embed.notice", { provider })}</p>
        </div>
        <a className="link text-sm" href={embed.link} target="_blank" rel="noopener noreferrer">
          {kind === "video"
            ? t("siteText.embed.watchOn", { provider })
            : t("siteText.embed.openIn", { provider })}
        </a>
      </div>
    </div>
  );
}
