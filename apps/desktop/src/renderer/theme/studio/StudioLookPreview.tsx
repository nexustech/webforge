import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { NodeDoc, Theme } from "@webforge/model";
import { type RefObject, useState } from "react";
import type { ItemPreviews } from "../../editor/areas.js";

/** Which look the larger preview shows: the theme's now, or with the changes not applied yet. */
type Shown = "now" | "draft";

/** Props of {@link StudioLookPreview}. */
type StudioLookPreviewProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The kind's name: "Button". */
  readonly item: string;
  /** The kind drawn: with its defaults, made once per kind so each drawing is kept. */
  readonly node: NodeDoc;
  readonly theme: Theme;
  /** The theme with the look not applied yet; none while there are no changes. */
  readonly draft: Theme | undefined;
  readonly previews: ItemPreviews;
  /** Where the focus goes back to once it closes: the preview that opened it. */
  readonly opener: RefObject<HTMLElement | null>;
};

/**
 * Theme Studio's larger preview of a kind (4.10): it at full width on Desktop and on Mobile (3.13a's
 * item previews), and a switch between the theme as it is and with the changes not applied yet,
 * so the person sees exactly what Apply will change. Opened from Components' preview.
 */
export function StudioLookPreview({
  open,
  onOpenChange,
  item,
  node,
  theme,
  draft,
  previews,
  opener,
}: StudioLookPreviewProps) {
  // The changes first, while there are some: they are what the person is looking at. Each opening
  // starts on them again, whatever was shown last time; the dialog itself stays, so it closes as
  // a dialog does and gives the focus back to the preview.
  const [chosen, setChosen] = useState<Shown>("draft");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChosen("draft");
  }
  const shown: Shown = draft === undefined ? "now" : chosen;
  const drawnIn = shown === "draft" && draft !== undefined ? draft : theme;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] flex-col gap-3 overflow-auto sm:max-w-3xl"
        // Back to the preview that opened it, for the keyboard: it is no trigger of the dialog's.
        onCloseAutoFocus={(event) => {
          if (opener.current === null) return;
          event.preventDefault();
          opener.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("theme.components.previewTitle", { item })}</DialogTitle>
          <DialogDescription>
            {t("theme.components.previewDescription", { item })}
          </DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          aria-label={t("theme.components.previewShow")}
          className="self-start"
          value={shown}
          onValueChange={(next) => {
            if (next === "now" || next === "draft") setChosen(next);
          }}
        >
          <ToggleGroupItem value="now" className="px-3">
            {t("theme.components.previewNow")}
          </ToggleGroupItem>
          <ToggleGroupItem value="draft" className="px-3" disabled={draft === undefined}>
            {t("theme.components.previewDraft")}
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-wrap items-start gap-4">
          {(["desktop", "mobile"] as const).map((device) => (
            <figure
              key={device}
              aria-label={t("theme.components.previewOn", { item, device: t(`device.${device}`) })}
              className="m-0 flex flex-col gap-1"
            >
              <figcaption className="text-xs text-muted-foreground">
                {t(`device.${device}`)}
              </figcaption>
              {previews(node, device, drawnIn)}
            </figure>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
