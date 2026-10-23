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
import type { FileMeta, ImageMeta, MediaId, MediaMeta } from "@webforge/model";
import { ImagePlusIcon } from "lucide-react";
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
import { useDocument } from "../editor/use-document.js";
import { useGesture } from "../editor/use-gesture.js";
import { siteSession } from "../storage/site-session.js";
import { documentIcon, documentTypeName, fileSizeLabel } from "./document-types.js";
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
import { mediaUsage, unplacedSharedUsage } from "./media-usage.js";

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

/** Why deleting `item` warns when only shared sections no page shows yet use it (F-ED-23). */
function sharedUsageText(item: MediaMeta, shared: readonly string[]): string {
  const [first] = shared;
  const name = t("history.namedItem", { name: first ?? "" });
  const names = shared.map((each) => t("history.namedItem", { name: each })).join(", ");
  if (item.kind === "file") {
    return shared.length === 1
      ? t("site.media.deleteDialog.linkedFromShared", { name })
      : t("site.media.deleteDialog.linkedFromSharedMany", { names });
  }
  return shared.length === 1
    ? t("site.media.deleteDialog.usedInShared", { name })
    : t("site.media.deleteDialog.usedInSharedMany", { names });
}

/**
 * The Site panel's Media (F-ED-5, G14, G15): the site's images and files, added from a dialog or by
 * dropping them on the panel. Choosing one shows its details: alt text (reused wherever the image
 * is placed), the focal point, a crop with aspect presets, Replace and Delete. Every change is one
 * undo step.
 */
export function MediaPanel({
  session,
  media,
  notify = toast,
  imageUrl = mediaImageUrl,
}: MediaPanelProps) {
  const items = useDocument(session, (site) => site.media);
  const [selectedId, setSelectedId] = useState<MediaId>();
  const [dragging, setDragging] = useState(false);
  /** An image to delete that pages still use, and how many: the user confirms first. */
  // The item to delete once confirmed, with the pages using it, or else the shared sections no
  // page shows yet that use it (F-ED-23).
  const [confirming, setConfirming] = useState<{
    item: MediaMeta;
    pages: number;
    shared: readonly string[];
  }>();
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
          onClick={() => void importWith(() => api.choose(siteSession()))}
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
                    <DocumentTile file={item} />
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
              void importItems(() => api.choose(siteSession()), notify).then(([replacement]) => {
                if (replacement !== undefined) replaceMedia(session, selected.id, replacement);
              })
            }
            onDelete={() => {
              const site = session.history.document.getState();
              const pages = mediaUsage(site, session.library).get(selected.id) ?? 0;
              const shared = unplacedSharedUsage(site, session.library).get(selected.id) ?? [];
              if (pages === 0 && shared.length === 0) {
                deleteMedia(session, selected.id);
                setSelectedId(undefined);
              } else {
                setConfirming({ item: selected, pages, shared });
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
              {confirming !== undefined && confirming.pages === 0
                ? sharedUsageText(confirming.item, confirming.shared)
                : confirming?.item.kind === "file"
                  ? confirming.pages === 1
                    ? t("site.media.deleteDialog.linkedFromOne")
                    : t("site.media.deleteDialog.linkedFromMany", { count: confirming.pages })
                  : confirming?.pages === 1
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
      ) : (
        <p className="m-0 text-xs text-muted-foreground">{documentFacts(item)}</p>
      )}
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

/** A document's place in the grid: its type's icon and size; never a preview (1.28). */
function DocumentTile({ file }: { readonly file: FileMeta }) {
  const Icon = documentIcon(file.mimeType);
  return (
    <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1">
      <Icon aria-hidden className="size-6 text-muted-foreground" />
      {file.size === undefined ? null : (
        <span className="text-[0.6875rem] text-muted-foreground">{fileSizeLabel(file.size)}</span>
      )}
    </span>
  );
}

/** What a document is, for its details: "Word document, 820 KB". */
function documentFacts(file: FileMeta): string {
  const type = documentTypeName(file.mimeType);
  return file.size === undefined
    ? type
    : t("site.media.documentFacts", { type, size: fileSizeLabel(file.size) });
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
