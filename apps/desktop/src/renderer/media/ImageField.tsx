import {
  Button,
  cn,
  type FieldRendererProps,
  fieldControlClass,
  registerFieldRenderer,
  toast,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ImageMeta, type ImageValue, imageValueSchema, isImageMeta } from "@webforge/model";
import { ImagePlusIcon } from "lucide-react";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { type MediaApi, mediaImageUrl } from "../../shared/ipc/media.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { ImagePickRequests } from "./image-picks.js";
import { importItems } from "./import-media.js";
import { addMedia } from "./media-commands.js";

/** What the image field needs besides its field's props. */
export type ImageFieldContext = {
  readonly session: EditorSession;
  /** The preload API's Media calls; injectable for tests and stories. */
  readonly media?: Pick<MediaApi, "choose">;
  readonly notify?: (message: string) => void;
  readonly imageUrl?: (item: ImageMeta, size: "thumbnail") => string;
  /** Requests to open the picker from the canvas (*Edit* on an image, F-ED-25). */
  readonly picks?: ImagePickRequests;
};

/**
 * The Edit panel's image field (F-ED-5, G15): which Media image an element shows, chosen from
 * Media's images or added on the spot, and alt text for this placement only. Left empty, the alt
 * text is the image's own from Media, so describing an image once covers every placement.
 */
export function ImageField({
  id,
  labelId,
  value,
  onChange,
  onCommit,
  session,
  media,
  notify = (message) => toast(message),
  imageUrl = mediaImageUrl,
  picks,
}: FieldRendererProps & ImageFieldContext) {
  const items = useSyncExternalStore(
    session.history.document.subscribe,
    () => session.history.document.getState().media,
  );
  const [picking, setPicking] = useState(false);
  // *Edit* on the selected element's image (F-ED-25): its picker opens, focus on its button.
  useEffect(() => {
    if (picks === undefined) return undefined;
    const open = () => {
      if (!picks.take(session.ui.getState().nodeId)) return;
      setPicking(true);
      document.getElementById(id)?.focus();
    };
    open();
    return picks.subscribe(open);
  }, [picks, session, id]);
  const altId = useId();
  const actionId = useId();
  const altHintId = useId();
  const placed = imageValueSchema.safeParse(value);
  const current = placed.success ? placed.data : undefined;
  const item = current === undefined ? undefined : items[current.mediaId];
  const image = item !== undefined && isImageMeta(item) ? item : undefined;
  const images = Object.values(items).filter(isImageMeta);
  const api = media ?? window.webforge.media;

  /** One choice: a new value, then the end of the run, so it is one undo step. */
  const choose = (next: ImageValue | undefined) => {
    onChange(next);
    onCommit();
    setPicking(false);
  };
  // Another image gets its own alt text from Media: the old override described the old image.
  const pick = (chosen: ImageMeta) => choose({ mediaId: chosen.id });
  const addNew = async () => {
    const added = (await importItems(() => api.choose(), notify)).filter(isImageMeta);
    addMedia(session, added);
    const [first] = added;
    if (first !== undefined) pick(first);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {image === undefined ? (
        current === undefined ? null : (
          <p className="m-0 text-xs text-muted-foreground">{t("site.media.field.missing")}</p>
        )
      ) : (
        <figure className="m-0 flex flex-col gap-1">
          <img
            src={imageUrl(image, "thumbnail")}
            alt=""
            className="aspect-[4/3] w-full rounded-sm bg-input object-cover"
          />
          <figcaption className="truncate text-xs">{image.fileName}</figcaption>
        </figure>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button
          id={id}
          type="button"
          size="sm"
          variant="outline"
          // "Image, Choose an image…": the field's label, then what the button does.
          aria-labelledby={`${labelId} ${actionId}`}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
        >
          <span id={actionId}>
            {current === undefined ? t("site.media.field.choose") : t("site.media.field.change")}
          </span>
        </Button>
        {current === undefined ? null : (
          <Button type="button" size="sm" variant="ghost" onClick={() => choose(undefined)}>
            {t("site.media.field.remove")}
          </Button>
        )}
      </div>
      {picking ? (
        <div className="flex flex-col gap-1.5 rounded-sm border border-border p-1.5">
          {images.length === 0 ? (
            <p className="m-0 text-xs text-muted-foreground">{t("site.media.field.noImages")}</p>
          ) : (
            <ul
              aria-label={t("site.media.field.pick")}
              className="m-0 grid list-none grid-cols-3 gap-1 p-0"
            >
              {images.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    aria-label={candidate.fileName}
                    aria-pressed={candidate.id === current?.mediaId}
                    title={candidate.fileName}
                    className={cn(
                      "block w-full overflow-hidden rounded-sm border border-border outline-none",
                      "hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
                      candidate.id === current?.mediaId && "border-ring",
                    )}
                    onClick={() => pick(candidate)}
                  >
                    <img
                      src={imageUrl(candidate, "thumbnail")}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => void addNew()}>
              <ImagePlusIcon />
              {t("site.media.field.addNew")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(false)}>
              {t("site.media.field.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {current === undefined ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor={altId} className="text-xs text-muted-foreground">
            {t("site.media.field.alt")}
          </label>
          <input
            id={altId}
            type="text"
            className={fieldControlClass}
            aria-describedby={altHintId}
            value={current.alt ?? ""}
            placeholder={
              image === undefined || image.alt === ""
                ? t("site.media.field.altNone")
                : t("site.media.field.altFrom", { alt: image.alt })
            }
            onChange={(event) => {
              const alt = event.target.value;
              // Emptied, the placement uses the image's own alt text again.
              onChange(
                alt === "" ? { mediaId: current.mediaId } : { mediaId: current.mediaId, alt },
              );
            }}
            onBlur={onCommit}
          />
          <p id={altHintId} className="m-0 text-xs text-muted-foreground">
            {t("site.media.field.altHint")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Makes the Edit panel draw image fields (`media` fields, as the `image` kind) with
 * {@link ImageField} for `session`. Returns the function that puts the previous renderer back.
 */
export function registerImageField(context: ImageFieldContext): () => void {
  function SessionImageField(props: FieldRendererProps) {
    return <ImageField {...props} {...context} />;
  }
  return registerFieldRenderer("image", SessionImageField);
}
