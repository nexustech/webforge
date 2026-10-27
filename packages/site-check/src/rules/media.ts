import { eachLink, imageValueSchema, type MediaId, mediaItem } from "@webforge/model";
import { eachFieldValue } from "../fields.js";
import type { CheckRule } from "../types.js";

/** Wider or taller than this, an original is far more than any screen shows (X5). */
const LARGE_IMAGE_PX = 4000;

/** Over this, a download is slow on a phone (F-ED-24): 10 MB, as the Media panel counts. */
const LARGE_FILE_BYTES = 10_000_000;

/**
 * Images the site shows whose original is over 4000 px wide or tall (X5): the export makes smaller
 * copies, but the original makes the export slow and large. Each image once, wherever it's placed.
 */
export const largeImagesRule: CheckRule = {
  id: "largeImages",
  level: "should",
  check: (input) => {
    const used = new Set<MediaId>();
    eachFieldValue(input, ["media"], ({ value }) => {
      const image = imageValueSchema.safeParse(value);
      if (image.success) used.add(image.data.mediaId);
    });
    return [...used].flatMap((mediaId) => {
      const meta = mediaItem(input.site.media, mediaId);
      if (meta?.kind !== "image") return [];
      return Math.max(meta.width, meta.height) > LARGE_IMAGE_PX
        ? [
            {
              key: mediaId,
              place: { kind: "media", mediaId } as const,
              values: { name: meta.fileName, width: meta.width, height: meta.height },
            },
          ]
        : [];
    });
  },
};

/**
 * Files in Media that pages link to and that are over 10 MB (F-ED-24): a tip, as a visitor on a
 * phone waits for them. Files nothing links to aren't exported, so they don't count.
 */
export const largeFilesRule: CheckRule = {
  id: "largeFiles",
  level: "tip",
  check: ({ site }) => {
    const linked = new Set<MediaId>();
    eachLink(
      site,
      (_on, _nodeId, link) => {
        if (link.kind === "file") linked.add(link.mediaId);
      },
      { skipHidden: true },
    );
    return [...linked].flatMap((mediaId) => {
      const meta = mediaItem(site.media, mediaId);
      if (meta?.kind !== "file" || (meta.size ?? 0) <= LARGE_FILE_BYTES) return [];
      return [
        {
          key: mediaId,
          place: { kind: "media", mediaId } as const,
          values: { name: meta.fileName, bytes: meta.size ?? 0 },
        },
      ];
    });
  },
};
