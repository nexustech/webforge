import {
  Button,
  cn,
  type FieldRenderer,
  type FieldRendererProps,
  fieldControlClass,
  Picker,
  type PickerItem,
} from "@webforge/editor-ui";
import { isMessageKey, type MessageKey, plural, t } from "@webforge/i18n";
import { type FontRef, fontRefSchema } from "@webforge/model";
import { FONT_CATALOGUE, previewFileOf } from "@webforge/themes";
import { DownloadIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { BrowsableFont, FontsApi, InstalledFont } from "../../../shared/ipc/fonts.js";
import { addFontPreviews, previewFamily } from "./font-previews.js";

/** A category's name in the picker: `fonts.category.<category>`, or the category as it is. */
const categoryName = (category: string) => {
  const key = `fonts.category.${category}`;
  return isMessageKey(key) ? t(key) : category;
};

/** The bundled fonts, as the computer lists them: what the picker shows until it has the list. */
const BUNDLED: readonly InstalledFont[] = FONT_CATALOGUE.map((font) => {
  const file = previewFileOf(font);
  const preview = file === undefined ? undefined : { file: file.file, weight: file.weight };
  return {
    id: font.id,
    family: font.family,
    fallback: font.fallback,
    category: font.category,
    variable: font.variable,
    source: "bundled",
    ...(preview === undefined ? {} : { preview }),
  };
});

/** A font as the picker lists it: one the computer has, or one to download (*Browse all fonts*). */
type FontItem = PickerItem &
  ({ readonly installed: InstalledFont } | { readonly toDownload: BrowsableFont });

/** The list of fonts to download, as far as *Browse all fonts* has got. */
type Browse =
  | { readonly status: "closed" | "loading" }
  | { readonly status: "listed"; readonly fonts: readonly BrowsableFont[] }
  | { readonly status: "failed"; readonly reason: "offline" | "unknown" };

/** What the field says under its button: a download under way, or why one didn't happen. */
type Status = { readonly downloading: string } | { readonly problem: string } | null;

/** Why a download failed, in words, naming the font: nothing changed. */
const DOWNLOAD_PROBLEMS: Readonly<
  Record<"offline" | "not-allowed" | "damaged" | "unknown", MessageKey>
> = {
  offline: "fonts.download.offline",
  "not-allowed": "fonts.download.notAllowed",
  damaged: "fonts.download.damaged",
  unknown: "fonts.download.unknown",
};

/** What the field needs besides its props: the computer's fonts, through main (2.2). */
type FontFieldContext = {
  /** `window.webforge.fonts`, asked for as it's needed. */
  readonly fonts: () => FontsApi;
};

/**
 * Reads the fonts this computer has through `fonts`, downloaded ones too, adds their previews (on
 * the editor's page) and gives them to `then`. Without the app's fonts (a story, a test), nothing.
 */
function listInstalled(
  fonts: () => FontsApi,
  then: (list: readonly InstalledFont[]) => void,
): void {
  void Promise.resolve()
    .then(() => fonts().list())
    .then((list) => {
      addFontPreviews(document, list);
      then(list);
    })
    .catch(() => undefined);
}

/** Downloads font `id` through `fonts`, a failure of any kind answered as one. */
async function downloaded(fonts: () => FontsApi, id: string) {
  try {
    return await fonts().download(id);
  } catch {
    return { status: "failed", reason: "unknown" } as const;
  }
}

/** Lists the fonts to download through `fonts`, as *Browse all fonts* shows them. */
async function browsed(fonts: () => FontsApi): Promise<Browse> {
  try {
    const result = await fonts().browse();
    return result.status === "listed"
      ? { status: "listed", fonts: result.fonts }
      : { status: "failed", reason: result.reason };
  } catch {
    return { status: "failed", reason: "unknown" };
  }
}

/**
 * A theme font in the Theme tab (2.3a, 2.3c, F-DS-2): the font, shown in itself, and a button that
 * opens the font picker (UX-15's shared picker). The picker lists the fonts this computer has, the
 * bundled and the downloaded, by category, each shown in itself, with a larger preview in sample
 * text the person can change. *Browse all fonts* lists Fontsource's others, fetched only then (P8);
 * one of those is downloaded once chosen, then used. A choice is one change; a download that fails
 * says why, and changes nothing.
 */
export function FontField({
  id,
  labelId,
  disabled = false,
  value,
  onChange,
  onCommit,
  fonts,
}: FieldRendererProps<"font"> & FontFieldContext) {
  const [picking, setPicking] = useState(false);
  const [sample, setSample] = useState(() => t("fonts.picker.sample"));
  const [installed, setInstalled] = useState<readonly InstalledFont[]>(BUNDLED);
  const [browse, setBrowse] = useState<Browse>({ status: "closed" });
  const [status, setStatus] = useState<Status>(null);
  const actionId = useId();
  const sampleId = useId();
  const statusId = useId();
  const parsed = fontRefSchema.safeParse(value);
  const current = parsed.success ? parsed.data : undefined;
  const shown = installed.find((font) => font.family === current?.family);

  // The computer's fonts as the field shows, so its font is found and shown in itself.
  useEffect(() => {
    addFontPreviews(document);
    let live = true;
    listInstalled(fonts, (list) => {
      if (live) setInstalled(list);
    });
    return () => {
      live = false;
    };
  }, [fonts]);

  /** Uses `font`: one change, if it's another font. */
  const use = (font: FontRef) => {
    if (font.family === current?.family) return;
    onChange({ family: font.family, fallback: font.fallback });
    onCommit();
  };

  /** Lists the fonts to download (P8: only now, as the person asks). */
  const browseAll = async () => {
    setBrowse({ status: "loading" });
    setBrowse(await browsed(fonts));
  };

  /** Downloads `font`, then uses it; or says why it couldn't, changing nothing. */
  const download = async (font: BrowsableFont) => {
    setStatus({ downloading: font.family });
    const result = await downloaded(fonts, font.id);
    if (result.status === "failed") {
      setStatus({ problem: t(DOWNLOAD_PROBLEMS[result.reason], { name: font.family }) });
      return;
    }
    const added = result.font;
    setStatus(null);
    setInstalled((list) => [...list.filter((each) => each.id !== added.id), added]);
    addFontPreviews(document, [added]);
    use(added);
  };

  const toDownload =
    browse.status === "listed" ? browse.fonts.filter((font) => !font.installed) : [];
  const items: FontItem[] = [
    ...installed.map((font) => ({
      id: font.id,
      label: font.family,
      category: categoryName(font.category),
      keywords: [font.category],
      installed: font,
    })),
    ...toDownload.map((font) => ({
      id: font.id,
      label: font.family,
      category: t("fonts.category.toDownload"),
      keywords: [font.category, categoryName(font.category)],
      toDownload: font,
    })),
  ];
  const categories = [
    ...new Set(installed.map((font) => categoryName(font.category))),
    ...(toDownload.length === 0 ? [] : [t("fonts.category.toDownload")]),
  ];
  const browseLine =
    browse.status === "loading"
      ? t("fonts.browse.loading")
      : browse.status === "failed"
        ? t(browse.reason === "offline" ? "fonts.browse.offline" : "fonts.browse.failed")
        : browse.status === "listed"
          ? plural("fonts.browse.listed", toDownload.length)
          : undefined;
  const busy = status !== null && "downloading" in status;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        id={id}
        type="button"
        size="sm"
        variant="outline"
        className="min-w-0 justify-start"
        // "Headings, Inter": the field's label, then the font.
        aria-labelledby={`${labelId} ${actionId}`}
        aria-describedby={status === null ? undefined : statusId}
        aria-haspopup="dialog"
        disabled={disabled || busy}
        onClick={() => {
          setStatus(null);
          setPicking(true);
          // Again as the picker opens: a font another field downloaded since is listed, and isn't
          // offered for download again (#463 review).
          listInstalled(fonts, setInstalled);
        }}
      >
        <span
          id={actionId}
          className="truncate"
          style={current === undefined ? undefined : { fontFamily: previewFamily(current) }}
        >
          {current === undefined ? t("fonts.choose") : t("fonts.change", { name: current.family })}
        </span>
      </Button>
      <p id={statusId} aria-live="polite" className="m-0 text-xs empty:hidden">
        {status === null
          ? null
          : "downloading" in status
            ? t("fonts.download.progress", { name: status.downloading })
            : status.problem}
      </p>
      <Picker
        open={picking}
        onOpenChange={setPicking}
        title={t("fonts.picker.title")}
        description={t("fonts.picker.description")}
        items={items}
        categories={categories}
        layout="list"
        value={shown?.id ?? null}
        renderItem={(item) =>
          "installed" in item ? (
            <span
              aria-hidden
              className="text-lg"
              style={{ fontFamily: previewFamily(item.installed) }}
            >
              {t("fonts.picker.tile")}
            </span>
          ) : (
            <DownloadIcon aria-hidden className="size-4 text-muted-foreground" />
          )
        }
        renderPreview={(item) =>
          "installed" in item ? (
            <p
              className="m-0 text-2xl break-words"
              style={{ fontFamily: previewFamily(item.installed) }}
            >
              {sample.trim() === "" ? item.label : sample}
            </p>
          ) : (
            <>
              <p className="m-0 text-lg">{item.label}</p>
              <p className="m-0 text-xs text-muted-foreground">{t("fonts.picker.notDownloaded")}</p>
            </>
          )
        }
        actions={
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <label htmlFor={sampleId} className="shrink-0 text-xs text-muted-foreground">
              {t("fonts.picker.sampleLabel")}
            </label>
            <input
              id={sampleId}
              className={cn(fieldControlClass, "h-7 w-40 text-xs")}
              value={sample}
              maxLength={80}
              onChange={(event) => setSample(event.currentTarget.value)}
            />
            {browse.status === "closed" || browse.status === "failed" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void browseAll()}>
                {t("fonts.browse")}
              </Button>
            ) : null}
            {browseLine === undefined ? null : (
              <span aria-live="polite" className="text-xs text-muted-foreground">
                {browseLine}
              </span>
            )}
          </div>
        }
        onChoose={(item) => {
          setPicking(false);
          if ("installed" in item) use(item.installed);
          else void download(item.toDownload);
        }}
        emptyText={t("fonts.picker.none")}
      />
    </div>
  );
}

/** The font field, with the computer's fonts through `fonts` (`window.webforge.fonts`). */
export function fontFieldRenderer(fonts: FontFieldContext["fonts"]): FieldRenderer<"font"> {
  return function ComputerFontField(props: FieldRendererProps<"font">) {
    return <FontField {...props} fonts={fonts} />;
  };
}
