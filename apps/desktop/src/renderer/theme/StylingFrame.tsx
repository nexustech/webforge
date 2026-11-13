import {
  cn,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ComponentProps, type ReactNode, useRef } from "react";

/** The devices a preview strip shows side by side: Desktop wide, Mobile beside it. */
const PREVIEW_DEVICES = ["desktop", "mobile"] as const;

/** A device a preview strip shows. */
type PreviewDevice = (typeof PREVIEW_DEVICES)[number];

/** What can take the focus, for the first of the controls to take it as the dialog opens. */
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How tall the preview starts, of the frame's body, and the least the preview and controls keep. */
const SIZES = { preview: "40%", previewMin: "6rem", controlsMin: "14rem" } as const;

/** Props of {@link StylingFrame}. */
type StylingFrameProps = Omit<ComponentProps<typeof DialogContent>, "title" | "children"> & {
  readonly title: ReactNode;
  readonly description: ReactNode;
  /** The strip at the top that stays in view ({@link PreviewStrip}); none to give the controls it all. */
  readonly preview?: ReactNode;
  /** The controls, under the preview at full width: they scroll on their own. */
  readonly children: ReactNode;
  /** The bar at the bottom, always in view: where the changes apply, and the dialog's buttons. */
  readonly actions?: ReactNode;
};

/**
 * Theme Studio's and *Style this ‹kind›…*'s frame (CT-11): a dialog that fills the window but for a
 * 1rem margin (still a dialog in the window, F-DS-7), with a preview strip fixed at the top, the
 * controls below it at full width, and the actions fixed at the bottom. The divider between the
 * preview and the controls moves by mouse and by the arrow keys; the controls keep a least height.
 */
export function StylingFrame({
  title,
  description,
  preview,
  children,
  actions,
  className,
  onOpenAutoFocus,
  ...content
}: StylingFrameProps) {
  const controls = useRef<HTMLDivElement>(null);
  return (
    <DialogContent
      className={cn(
        "flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-3 sm:max-w-none",
        className,
      )}
      {...content}
      // The focus starts in the controls, not on the preview above them, which is focusable only
      // to be scrolled.
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) return;
        const first = controls.current?.querySelector<HTMLElement>(FOCUSABLE);
        if (first === null || first === undefined) return;
        event.preventDefault();
        first.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {preview === undefined ? (
        <div ref={controls} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      ) : (
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
          <ResizablePanel id="preview" defaultSize={SIZES.preview} minSize={SIZES.previewMin}>
            <div className="flex h-full min-h-0 flex-col pb-3">{preview}</div>
          </ResizablePanel>
          <ResizableHandle aria-label={t("styling.resizePreview")} />
          <ResizablePanel id="controls" minSize={SIZES.controlsMin}>
            <div ref={controls} className="flex h-full min-h-0 flex-col pt-3">
              {children}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      {actions === undefined ? null : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border pt-3">
          {actions}
        </div>
      )}
    </DialogContent>
  );
}

/** Props of {@link PreviewStrip}. */
type PreviewStripProps = {
  /** The strip's name for screen readers: "Preview". */
  readonly label: string;
  /** What the strip shows on `device`: the item, a kind, a sample page. */
  readonly draw: (device: PreviewDevice) => ReactNode;
  /** Above the devices: Theme Studio's *Theme now / With your changes* (4.10). */
  readonly toolbar?: ReactNode;
};

/**
 * The preview at the top of a {@link StylingFrame} (CT-11): Desktop and Mobile side by side, each
 * as wide as the strip allows and scrolling on its own when what it draws is taller than the strip.
 */
export function PreviewStrip({ label, draw, toolbar }: PreviewStripProps) {
  return (
    <section aria-label={label} className="flex h-full min-h-0 flex-col gap-2">
      {toolbar}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(10rem,18rem)] gap-4">
        {PREVIEW_DEVICES.map((device) => (
          <figure key={device} className="m-0 flex min-h-0 min-w-0 flex-col gap-1">
            <figcaption className="text-xs text-muted-foreground">
              {t(`device.${device}`)}
            </figcaption>
            <section
              aria-label={t("styling.previewOn", { device: t(`device.${device}`) })}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region keyboards must reach.
              tabIndex={0}
              // Its scrollbar's room kept: a preview fills the width, which a scrollbar coming and
              // going would change, and with it the preview's height, over and over.
              className="min-h-0 flex-1 overflow-auto rounded-sm [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-ring"
            >
              {draw(device)}
            </section>
          </figure>
        ))}
      </div>
    </section>
  );
}
