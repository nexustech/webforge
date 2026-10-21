import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  fieldControlClass,
  ScrollArea,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ImageMeta, MediaId, MediaMeta } from "@webforge/model";
import { FileTextIcon, ImagePlusIcon } from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { type MediaApi, mediaImageUrl } from "../../shared/ipc/media.js";
import type { EditorSession } from "../editor/editor-session.js";
import { useGesture } from "../editor/use-gesture.js";
import { importDroppedFiles, importItems } from "./import-media.js";
import {
  addMedia,
  CROP_PRESETS,
  cropMedia,
  cropPresetOf,
  deleteMedia,
  replaceMedia,
  setFocalPoint,
} from "./media-commands.js";
import { mediaUsage } from "./media-usage.js";

/** Props of {@link MediaPanel}. */
export type MediaPanelProps = {
  readonly session: EditorSession;
  /** The preload API's Media calls; injectable for tests and stories. */
  readonly media?: Pick<MediaApi, "import" | "choose">;
  /** Shows a message, e.g. why a file wasn't added; a toast by default. */
  readonly notify?: (message: string) => void;
  /** Where an image shows; the `webforge-media:` scheme by default, data URLs in stories. */
  readonly imageUrl?: (item: ImageMeta, size: "thumbnail" | "original") => string;
};

/** How far one arrow-key press moves the focal point. */
const FOCAL_STEP = 0.05;

const ARROWS: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
  ArrowLeft: { x: -FOCAL_STEP, y: 0 },
  ArrowRight: { x: FOCAL_STEP, y: 0 },
  ArrowUp: { x: 0, y: -FOCAL_STEP },
  ArrowDown: { x: 0, y: FOCAL_STEP },
};

/**
 * The Site panel's Media (F-ED-5, G14, G15): the site's images and files, added from a dialog or by
 * dropping them on the panel. Choosing one shows its details: alt text (reused wherever the image
 * is placed), the focal point, a crop with aspect presets, Replace and Delete. Every change is one
 * undo step.
 */
export function MediaPanel({
  session,
  media,
  notify = (message) => toast(message),
  imageUrl = mediaImageUrl,
}: MediaPanelProps) {
  const items = useSyncExternalStore(
    session.history.document.subscribe,
    () => session.history.document.getState().media,
  );
  const [selectedId, setSelectedId] = useState<MediaId>();
  const [dragging, setDragging] = useState(false);
  /** An image to delete that pages still use, and how many: the user confirms first. */
  const [confirming, setConfirming] = useState<{ item: MediaMeta; pages: number }>();
  const api = media ?? window.webforge.media;
  const list = Object.values(items);
  // Undo or another change can take the chosen item away.
  const selected = selectedId === undefined ? undefined : items[selectedId];

  const importWith = async (request: Parameters<typeof importItems>[0]) => {
    const added = await importItems(request, notify);
    addMedia(session, added);
    const [first] = added;
    if (first !== undefined) setSelectedId(first.id);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) {
      void importWith(() => importDroppedFiles(files, api));
    }
  };

  return (
    <section
      aria-label={t("site.media.title")}
      className={cn(
        "flex h-full min-h-0 flex-col",
        dragging && "outline-2 -outline-offset-2 outline-ring",
      )}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        const into = event.relatedTarget;
        if (!(into instanceof Node && event.currentTarget.contains(into))) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-1 p-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void importWith(() => api.choose())}
        >
          <ImagePlusIcon />
          {t("site.media.add")}
        </Button>
        <p className="m-0 text-xs text-muted-foreground">{t("site.media.dropHint")}</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {list.length === 0 ? (
          <p className="m-0 px-2 text-xs text-muted-foreground">{t("site.media.empty")}</p>
        ) : (
          <ul
            aria-label={t("site.media.list")}
            className="m-0 grid list-none grid-cols-2 gap-1.5 p-2 pt-0"
          >
            {list.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={item.id === selectedId}
                  className={cn(
                    "flex w-full flex-col overflow-hidden rounded-sm border border-border bg-input text-left",
                    "outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
                    item.id === selectedId && "border-ring",
                  )}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.kind === "image" ? (
                    <img
                      src={imageUrl(item, "thumbnail")}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                      style={focalStyle(item)}
                    />
                  ) : (
                    <span className="flex aspect-[4/3] w-full items-center justify-center">
                      <FileTextIcon aria-hidden className="size-6 text-muted-foreground" />
                    </span>
                  )}
                  <span className="truncate px-1.5 py-1 text-xs">{item.fileName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selected === undefined ? null : (
          <MediaDetails
            key={selected.id}
            item={selected}
            session={session}
            imageUrl={imageUrl}
            onReplace={() =>
              // The first chosen file takes the item's place; it isn't added as an item of its own.
              void importItems(() => api.choose(), notify).then(([replacement]) => {
                if (replacement !== undefined) replaceMedia(session, selected.id, replacement);
              })
            }
            onDelete={() => {
              const pages =
                mediaUsage(session.history.document.getState(), session.library).get(selected.id) ??
                0;
              if (pages === 0) {
                deleteMedia(session, selected.id);
                setSelectedId(undefined);
              } else {
                setConfirming({ item: selected, pages });
              }
            }}
          />
        )}
      </ScrollArea>
      <AlertDialog
        open={confirming !== undefined}
        onOpenChange={(open) => {
          if (!open) setConfirming(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("site.media.deleteDialog.title", { name: confirming?.item.fileName ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.pages === 1
                ? t("site.media.deleteDialog.usedOnOne")
                : t("site.media.deleteDialog.usedOnMany", { count: confirming?.pages ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("site.media.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirming !== undefined) {
                  // Placements keep pointing at the image, so Undo brings every one of them back.
                  deleteMedia(session, confirming.item.id);
                  setSelectedId(undefined);
                }
              }}
            >
              {t("site.media.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** Keeps the focal point in view where a thumbnail is cut to fit (G14). */
function focalStyle(item: ImageMeta) {
  const focal = item.focal ?? { x: 0.5, y: 0.5 };
  return { objectPosition: `${focal.x * 100}% ${focal.y * 100}%` };
}

type DetailsProps = {
  readonly item: MediaMeta;
  readonly session: EditorSession;
  readonly imageUrl: NonNullable<MediaPanelProps["imageUrl"]>;
  readonly onReplace: () => void;
  readonly onDelete: () => void;
};

/** The chosen item's details and actions. */
function MediaDetails({ item, session, imageUrl, onReplace, onDelete }: DetailsProps) {
  return (
    <section
      aria-label={t("site.media.details", { name: item.fileName })}
      className="flex flex-col gap-3 border-t border-border p-2"
    >
      {item.kind === "image" ? (
        <ImageDetails image={item} session={session} imageUrl={imageUrl} />
      ) : null}
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={onReplace}>
          {t("site.media.replace")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
          {t("site.media.delete")}
        </Button>
      </div>
    </section>
  );
}

type ImageDetailsProps = {
  readonly image: ImageMeta;
  readonly session: EditorSession;
  readonly imageUrl: NonNullable<MediaPanelProps["imageUrl"]>;
};

/** An image's focal point, size, alt text and crop. */
function ImageDetails({ image, session, imageUrl }: ImageDetailsProps) {
  const ids = { alt: useId(), altHint: useId(), focalHint: useId(), crop: useId() };
  const alt = useGesture(session, "props", t("site.media.history.alt"));
  const focal = image.focal ?? { x: 0.5, y: 0.5 };
  const focalText = t("site.media.focalValue", {
    x: Math.round(focal.x * 100),
    y: Math.round(focal.y * 100),
  });

  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setFocalPoint(session, image.id, {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    });
  };
  const moveWithKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = ARROWS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setFocalPoint(session, image.id, { x: focal.x + step.x, y: focal.y + step.y }, true);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        {/* Pointer users click where the focal point goes; the marker takes the arrow keys. */}
        <div className="relative overflow-hidden rounded-sm bg-input" onPointerDown={pointAt}>
          <img
            src={imageUrl(image, "thumbnail")}
            alt=""
            className="block w-full"
            draggable={false}
          />
          {image.crop === undefined ? null : (
            <span
              aria-hidden
              className="pointer-events-none absolute border border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
              style={{
                left: `${image.crop.x * 100}%`,
                top: `${image.crop.y * 100}%`,
                width: `${image.crop.width * 100}%`,
                height: `${image.crop.height * 100}%`,
              }}
            />
          )}
          <button
            type="button"
            aria-label={t("site.media.focalAt", { value: focalText })}
            aria-describedby={ids.focalHint}
            title={focalText}
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
            onKeyDown={moveWithKeys}
            // The click on the image below moves the point; the marker itself stays put.
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
        <p id={ids.focalHint} className="m-0 text-xs text-muted-foreground">
          {t("site.media.focalHint")}
        </p>
        <p className="m-0 text-xs text-muted-foreground">
          {t("site.media.fileSize", { width: image.width, height: image.height })}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.alt} className="text-xs font-medium">
          {t("site.media.alt")}
        </label>
        <input
          id={ids.alt}
          type="text"
          className={fieldControlClass}
          aria-describedby={ids.altHint}
          value={image.alt}
          onChange={(event) => {
            const value = event.target.value;
            alt.update((draft) => {
              const current = draft.media[image.id];
              if (current?.kind === "image") current.alt = value;
            });
          }}
          onBlur={() => alt.commit()}
        />
        <p id={ids.altHint} className="m-0 text-xs text-muted-foreground">
          {t("site.media.altHint")}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <span id={ids.crop} className="text-xs font-medium">
          {t("site.media.crop")}
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby={ids.crop}
          className="flex-wrap"
          value={cropPresetOf(image) ?? ""}
          onValueChange={(value) => {
            const preset = CROP_PRESETS.find((candidate) => candidate.key === value);
            if (preset !== undefined) cropMedia(session, image.id, preset.key);
          }}
        >
          {CROP_PRESETS.map((preset) => (
            <ToggleGroupItem key={preset.key} value={preset.key}>
              {t(`site.media.crop.${preset.key}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  );
}
