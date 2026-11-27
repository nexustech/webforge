import {
  cn,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** The devices a preview shows: Desktop, then Mobile. */
const PREVIEW_DEVICES = ["desktop", "mobile"] as const;

/** A device a preview strip shows. */
type PreviewDevice = (typeof PREVIEW_DEVICES)[number];

/**
 * What can take the focus, for the first of the controls to take it as the dialog opens: never
 * one the keyboard skips (`tabindex="-1"`), such as a tab not chosen, which focus would choose.
 */
const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]",
]
  .map((each) => `${each}:not([tabindex="-1"])`)
  .join(", ");

/**
 * How much of the frame's body the preview starts with, and the least the preview and the controls
 * keep: beside the controls (H3), or above them in a frame taller than it is wide.
 */
const SIZES = {
  beside: { preview: "45%", previewMin: "14rem", controlsMin: "22rem" },
  above: { preview: "40%", previewMin: "6rem", controlsMin: "14rem" },
} as const;

/** One of {@link SIZES}. */
type Sizes = (typeof SIZES)[keyof typeof SIZES];

/**
 * Below this height of the dialog, its preview shows one device at a time, with a switch (H3): the
 * dialog in a window about 700 px tall or less (960 × 600's is about 530 px, 1366 × 768's 700).
 */
const SHORT_DIALOG_PX = 640;

/** The title bar and the dialog's margins, for its height before it is measured. */
const AROUND_DIALOG_PX = 72;

/** How a {@link StylingFrame} lays its preview out, for the {@link PreviewStrip} in it. */
type PreviewLayout = {
  /** Beside the controls, as the frame is wider than it is tall (H3); else above them. */
  readonly beside: boolean;
  /** One device at a time, with a switch: the dialog is short ({@link SHORT_DIALOG_PX}). */
  readonly short: boolean;
};

const PreviewLayoutContext = createContext<PreviewLayout>({ beside: false, short: false });

/**
 * The layout `body`'s size calls for, following it as the window changes: beside where it is wider
 * than tall, one device at a time where the dialog around it is short. Measured again whenever
 * `body` is drawn anew: a frame lives while its dialog is closed (Theme Studio's), and the window
 * can change meanwhile. Before it is measured (and where nothing measures, as in unit tests):
 * beside, short as the window's height says.
 */
function usePreviewLayout(body: HTMLElement | null): PreviewLayout {
  const [layout, setLayout] = useState<PreviewLayout>(() => ({
    beside: true,
    short: window.innerHeight - AROUND_DIALOG_PX < SHORT_DIALOG_PX,
  }));
  useLayoutEffect(() => {
    const place = body;
    if (place === null) return;
    const dialog = place.closest<HTMLElement>('[data-slot="dialog-content"]') ?? place;
    const measure = () => {
      const { width, height } = place.getBoundingClientRect();
      const tall = dialog.getBoundingClientRect().height;
      if (width === 0 || height === 0 || tall === 0) return;
      const beside = width > height;
      const short = tall < SHORT_DIALOG_PX;
      setLayout((was) => (was.beside === beside && was.short === short ? was : { beside, short }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(place);
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [body]);
  return layout;
}

/** Props of {@link StylingFrame}. */
type StylingFrameProps = Omit<ComponentProps<typeof DialogContent>, "title" | "children"> & {
  readonly title: ReactNode;
  readonly description: ReactNode;
  /** The preview that stays in view ({@link PreviewStrip}); none to give the controls it all. */
  readonly preview?: ReactNode;
  /** The controls, beside the preview at the frame's full height: they scroll on their own. */
  readonly children: ReactNode;
  /** The bar at the bottom, always in view: where the changes apply, and the dialog's buttons. */
  readonly actions?: ReactNode;
  /** A bar under the title, over the controls and the preview: Theme Studio's sections and kinds. */
  readonly bar?: ReactNode;
};

/**
 * Theme Studio's and *Style this ‹kind›…*'s frame (CT-11): a dialog that fills the window under its
 * title bar but for a 1rem margin (still a dialog in the window, F-DS-7), so the window's own
 * controls are never over its close button (#1411), with the controls at its full height and the
 * preview beside them on the right (H3, in place of 5.12's preview on top), and the actions fixed
 * at the bottom. In a frame taller than it is wide, the preview goes above the controls. The divider
 * between them moves by mouse and by the arrow keys; the controls keep a least size.
 */
export function StylingFrame({
  title,
  description,
  preview,
  children,
  actions,
  bar,
  className,
  onOpenAutoFocus,
  ...content
}: StylingFrameProps) {
  const top = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const layout = usePreviewLayout(body);
  const sizes = layout.beside ? SIZES.beside : SIZES.above;
  const handle = <ResizableHandle aria-label={t("styling.resizePreview")} />;
  return (
    <DialogContent
      className={cn(
        "flex h-(--dialog-max-height) w-[calc(100vw-2rem)] max-w-none flex-col gap-3 sm:max-w-none",
        className,
      )}
      {...content}
      // The focus starts in the bar, or the controls, not on the preview beside them, which is
      // focusable only to be scrolled.
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) return;
        const first = (top.current ?? controls.current)?.querySelector<HTMLElement>(FOCUSABLE);
        if (first === null || first === undefined) return;
        event.preventDefault();
        first.focus();
      }}
      // Its own, over one given by a root it is the child of (Theme Studio's tabs).
      data-slot="dialog-content"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {bar === undefined ? null : (
        <div ref={top} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {bar}
        </div>
      )}
      {preview === undefined ? (
        <div ref={controls} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      ) : (
        <div ref={setBody} className="flex min-h-0 flex-1 flex-col">
          <PreviewLayoutContext value={layout}>
            {/* Keyed by its direction, so turning starts from its own sizes. Beside, the controls
                come first, in reading and tab order. */}
            <ResizablePanelGroup
              key={layout.beside ? "beside" : "above"}
              orientation={layout.beside ? "horizontal" : "vertical"}
              className="min-h-0 flex-1"
            >
              {layout.beside ? null : previewPanel(preview, sizes, false)}
              {layout.beside ? null : handle}
              <ResizablePanel id="controls" minSize={sizes.controlsMin}>
                <div
                  ref={controls}
                  className={cn("flex h-full min-h-0 flex-col", layout.beside ? "pr-3" : "pt-3")}
                >
                  {children}
                </div>
              </ResizablePanel>
              {layout.beside ? handle : null}
              {layout.beside ? previewPanel(preview, sizes, true) : null}
            </ResizablePanelGroup>
          </PreviewLayoutContext>
        </div>
      )}
      {actions === undefined ? null : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border pt-3">
          {actions}
        </div>
      )}
    </DialogContent>
  );
}

/** The preview's panel, beside the controls or above them, holding `preview` at its full size. */
function previewPanel(preview: ReactNode, sizes: Sizes, beside: boolean) {
  return (
    <ResizablePanel id="preview" defaultSize={sizes.preview} minSize={sizes.previewMin}>
      <div className={cn("flex h-full min-h-0 flex-col", beside ? "pl-3" : "pb-3")}>{preview}</div>
    </ResizablePanel>
  );
}

/** Props of {@link PreviewStrip}. */
type PreviewStripProps = {
  /** The preview's name for screen readers: "Preview". */
  readonly label: string;
  /** What the preview shows on `device`: the item, a kind, a sample page. */
  readonly draw: (device: PreviewDevice) => ReactNode;
  /** Above the devices: Theme Studio's *Theme now / With your changes* (4.10). */
  readonly toolbar?: ReactNode;
};

/**
 * The preview in a {@link StylingFrame} (CT-11, H3). Beside the controls: Desktop, then Mobile, in
 * one column that scrolls, each as wide as the column allows and whole, never cut to a strip; in a
 * short dialog, one of them at a time, with a switch, so only the one shown is drawn. Above the
 * controls (a frame taller than wide): Desktop and Mobile side by side, each scrolling on its own.
 */
export function PreviewStrip({ label, draw, toolbar }: PreviewStripProps) {
  const { beside, short } = useContext(PreviewLayoutContext);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  if (!beside) {
    return (
      <section aria-label={label} className="flex h-full min-h-0 flex-col gap-2">
        {toolbar}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(10rem,18rem)] gap-4">
          {PREVIEW_DEVICES.map((each) => (
            <figure key={each} className="m-0 flex min-h-0 min-w-0 flex-col gap-1">
              <figcaption className="text-xs text-muted-foreground">
                {t(`device.${each}`)}
              </figcaption>
              <section
                aria-label={t("styling.previewOn", { device: t(`device.${each}`) })}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region keyboards must reach.
                tabIndex={0}
                // Its scrollbar's room kept: a preview fills the width, which a scrollbar coming and
                // going would change, and with it the preview's height, over and over.
                className="min-h-0 flex-1 overflow-auto rounded-sm [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-ring"
              >
                {draw(each)}
              </section>
            </figure>
          ))}
        </div>
      </section>
    );
  }
  const shown = short ? [device] : PREVIEW_DEVICES;
  return (
    <section
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region keyboards must reach.
      tabIndex={0}
      // The preview's one scroll area, top to bottom only, its switches in view at its top. Its
      // scrollbar's room kept: a preview fills the width, which a scrollbar coming and going would
      // change, and with it the preview's height, over and over.
      className="flex h-full min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto rounded-sm [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-ring"
    >
      {toolbar === undefined && !short ? null : (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-card pb-1">
          {short ? (
            <ToggleGroup
              type="single"
              aria-label={t("styling.device")}
              value={device}
              onValueChange={(next) => {
                const chosen = PREVIEW_DEVICES.find((each) => each === next);
                if (chosen !== undefined) setDevice(chosen);
              }}
            >
              {PREVIEW_DEVICES.map((each) => (
                <ToggleGroupItem key={each} value={each} className="px-3">
                  {t(`device.${each}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          {toolbar}
        </div>
      )}
      {shown.map((each) => (
        <figure key={each} className="m-0 flex min-w-0 flex-col gap-1">
          {short ? null : (
            <figcaption className="text-xs text-muted-foreground">{t(`device.${each}`)}</figcaption>
          )}
          <section
            aria-label={t("styling.previewOn", { device: t(`device.${each}`) })}
            className={each === "mobile" ? "w-full max-w-[18rem]" : "w-full"}
          >
            {draw(each)}
          </section>
        </figure>
      ))}
    </section>
  );
}
