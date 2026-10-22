import { t } from "@webforge/i18n";
import {
  cropForAspect,
  type ImageMeta,
  isImageMeta,
  type MediaId,
  type MediaMeta,
  mediaNameFor,
  type SiteDoc,
} from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";

/** What the Media commands need of the editor session. */
export type MediaSession = Pick<EditorSession, "edit"> & {
  readonly history: Pick<EditorSession["history"], "document">;
};

/** The crop presets of the Media panel (G14), by their i18n key; `undefined` is no crop. */
export const CROP_PRESETS = [
  { key: "original", aspect: undefined },
  { key: "square", aspect: 1 },
  { key: "landscape", aspect: 4 / 3 },
  { key: "photo", aspect: 3 / 2 },
  { key: "wide", aspect: 16 / 9 },
  { key: "portrait", aspect: 3 / 4 },
] as const;

/** A crop preset's key. */
export type CropPreset = (typeof CROP_PRESETS)[number]["key"];

const quoted = (name: string) => t("history.namedItem", { name });

/**
 * Adds imported items to the site's Media as one undo step ("Added image 'shop.jpg'"). Each gets a
 * name no other item has, since exported files are named after it.
 */
export function addMedia(session: MediaSession, items: readonly MediaMeta[]): void {
  const [first] = items;
  if (first === undefined) {
    return;
  }
  const label =
    items.length > 1
      ? t("site.media.history.addedMany", { count: items.length })
      : t(
          first.kind === "image" ? "site.media.history.addedImage" : "site.media.history.addedFile",
          {
            name: quoted(first.fileName),
          },
        );
  session.edit("insert", label, (draft) => putInMedia(draft, items));
}

/**
 * Puts `items` in a site's Media (in an undo step's draft), each with a name no other item has,
 * since exported files are named after it.
 */
export function putInMedia(site: Pick<SiteDoc, "media">, items: readonly MediaMeta[]): void {
  const taken = Object.values(site.media).map((item) => item.name);
  for (const item of items) {
    const name = mediaNameFor(item.name, item.kind, taken);
    taken.push(name);
    site.media[item.id] = { ...item, name };
  }
}

/**
 * Puts a new file in place of an item's (F-ED-5 "replace"): every placement shows the new one.
 * The item keeps its id, name, alt text and focal point; a crop made for the old image goes.
 */
export function replaceMedia(session: MediaSession, id: MediaId, replacement: MediaMeta): void {
  const current = session.history.document.getState().media[id];
  if (current === undefined) {
    return;
  }
  const label = t(
    current.kind === "image"
      ? "site.media.history.replacedImage"
      : "site.media.history.replacedFile",
    { name: quoted(current.fileName) },
  );
  session.edit("props", label, (draft) => {
    const before = draft.media[id];
    if (before === undefined) {
      return;
    }
    const kept = { id, name: before.name };
    draft.media[id] =
      replacement.kind === "image"
        ? {
            ...replacement,
            ...kept,
            alt: before.kind === "image" ? before.alt : replacement.alt,
            ...(before.kind === "image" && before.focal !== undefined
              ? { focal: before.focal }
              : {}),
          }
        : { ...replacement, ...kept };
  });
}

/**
 * Deletes an item from Media, as an undoable step with an Undo toast ("Deleted image 'shop.jpg'").
 * Its bytes stay in the site file until no undo step can bring it back (garbage collection when
 * the site is next opened or closed).
 */
export function deleteMedia(session: MediaSession, id: MediaId): void {
  const current = session.history.document.getState().media[id];
  if (current === undefined) {
    return;
  }
  const label = t(
    current.kind === "image" ? "site.media.history.deletedImage" : "site.media.history.deletedFile",
    { name: quoted(current.fileName) },
  );
  session.edit("remove", label, (draft) => {
    delete draft.media[id];
  });
}

/** Crops an image to a preset's shape around its focal point, or removes the crop. */
export function cropMedia(session: MediaSession, id: MediaId, preset: CropPreset): void {
  const item = session.history.document.getState().media[id];
  const aspect = CROP_PRESETS.find((candidate) => candidate.key === preset)?.aspect;
  if (item === undefined || !isImageMeta(item)) {
    return;
  }
  const crop = aspect === undefined ? undefined : cropForAspect(item, aspect);
  session.edit("props", t("site.media.history.cropped"), (draft) => {
    const image = draft.media[id];
    if (image?.kind !== "image") return;
    if (crop === undefined) {
      delete image.crop;
    } else {
      image.crop = crop;
    }
  });
}

/** The preset an image's crop matches, if any. */
export function cropPresetOf(item: ImageMeta): CropPreset | undefined {
  if (item.crop === undefined) {
    return "original";
  }
  const aspect = (item.crop.width * item.width) / (item.crop.height * item.height);
  return CROP_PRESETS.find(
    (preset) => preset.aspect !== undefined && Math.abs(preset.aspect - aspect) < 0.01,
  )?.key;
}

/**
 * Moves an image's focal point (G14), the part kept in view when a device view or a crop cuts it;
 * a crop moves with it, keeping its shape. `nudge` merges a run of arrow-key moves into one step.
 */
export function setFocalPoint(
  session: MediaSession,
  id: MediaId,
  focal: { readonly x: number; readonly y: number },
  nudge = false,
): void {
  const item = session.history.document.getState().media[id];
  if (item === undefined || !isImageMeta(item)) {
    return;
  }
  const point = {
    x: Math.round(Math.min(Math.max(focal.x, 0), 1) * 1000) / 1000,
    y: Math.round(Math.min(Math.max(focal.y, 0), 1) * 1000) / 1000,
  };
  const crop =
    item.crop === undefined
      ? undefined
      : cropForAspect(
          { ...item, focal: point },
          (item.crop.width * item.width) / (item.crop.height * item.height),
        );
  session.edit(
    "props",
    t("site.media.history.focal"),
    (draft) => {
      const image = draft.media[id];
      if (image?.kind !== "image") return;
      image.focal = point;
      if (crop !== undefined) image.crop = crop;
    },
    nudge ? { coalesceKey: `media:${id}:focal` } : undefined,
  );
}
