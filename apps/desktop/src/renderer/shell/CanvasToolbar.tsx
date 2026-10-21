import { cn, fieldControlClass, ToggleGroup, ToggleGroupItem } from "@webforge/editor-ui";
import type { Viewport } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { PageId } from "@webforge/model";
import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import { useId, useState } from "react";
import { type CanvasSize, type CanvasZoom, ZOOM_LEVELS } from "./canvas-view.js";

/** The device views' canvas widths, as the canvas engine shows them. */
export const DEVICE_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 } as const;

/** The narrowest and widest custom canvas width. */
const CUSTOM_WIDTH = { min: 320, max: 2560 } as const;

type Device = keyof typeof DEVICE_WIDTHS;

const DEVICES = [
  { id: "desktop", icon: MonitorIcon },
  { id: "tablet", icon: TabletIcon },
  { id: "mobile", icon: SmartphoneIcon },
] as const satisfies readonly { id: Device; icon: unknown }[];

/** A viewport's width in CSS pixels. */
export const widthOf = (viewport: Viewport): number =>
  typeof viewport === "number" ? viewport : DEVICE_WIDTHS[viewport];

/** A width as a viewport: a device view when it is one's width, a custom width otherwise. */
export function viewportFor(width: number): Viewport {
  const device = DEVICES.find(({ id }) => DEVICE_WIDTHS[id] === width);
  return device?.id ?? width;
}

/** Props of {@link CanvasToolbar}. */
export type CanvasToolbarProps = {
  /** The site's pages in Pages panel order. */
  readonly pages: readonly { readonly id: PageId; readonly title: string }[];
  readonly shownPageId: PageId;
  readonly onShowPage: (pageId: PageId) => void;
  readonly viewport: Viewport;
  readonly onViewportChange: (viewport: Viewport) => void;
  readonly zoom: CanvasZoom;
  readonly onZoomChange: (zoom: CanvasZoom) => void;
  /** The page's size and scale as the canvas shows it; null until known. */
  readonly size: CanvasSize | null;
};

/** A scale as a whole percentage: 0.64 → 64. */
const percent = (zoom: number) => Math.round(zoom * 100);

/**
 * The canvas toolbar (F-ED-8, UI1): which page the canvas shows, Desktop · Tablet · Mobile or a
 * custom width, the zoom, and the page's size and scale ("1280 × 879 @ 64%"). Changing them is
 * never an undo step (U6).
 */
export function CanvasToolbar({
  pages,
  shownPageId,
  onShowPage,
  viewport,
  onViewportChange,
  zoom,
  onZoomChange,
  size,
}: CanvasToolbarProps) {
  const pageId = useId();
  const zoomId = useId();
  return (
    <div
      role="toolbar"
      aria-label={t("canvasToolbar.label")}
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border-strong bg-toolbar px-2"
    >
      <label htmlFor={pageId} className="sr-only">
        {t("canvasToolbar.page")}
      </label>
      <select
        id={pageId}
        className={cn(fieldControlClass, "w-44")}
        value={shownPageId}
        onChange={(event) => onShowPage(event.currentTarget.value as PageId)}
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {page.title}
          </option>
        ))}
      </select>

      <ToggleGroup
        type="single"
        value={typeof viewport === "number" ? "" : viewport}
        aria-label={t("canvasToolbar.device")}
        onValueChange={(value) => {
          const device = DEVICES.find(({ id }) => id === value);
          if (device !== undefined) {
            onViewportChange(device.id);
          }
        }}
      >
        {DEVICES.map(({ id, icon: Icon }) => (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={t(`device.${id}`)}
            title={t(`device.${id}`)}
          >
            <Icon />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Keyed by the width, so it shows a width chosen elsewhere (a device, undo). */}
      <CustomWidth key={widthOf(viewport)} width={widthOf(viewport)} onChange={onViewportChange} />

      <label htmlFor={zoomId} className="sr-only">
        {t("canvasToolbar.zoom")}
      </label>
      <select
        id={zoomId}
        className={cn(fieldControlClass, "w-28")}
        value={String(zoom)}
        onChange={(event) => {
          const { value } = event.currentTarget;
          onZoomChange(value === "fit" ? "fit" : Number(value));
        }}
      >
        <option value="fit">
          {size === null
            ? t("canvasToolbar.zoomFit")
            : t("canvasToolbar.zoomFitAt", { zoom: percent(size.zoom) })}
        </option>
        {ZOOM_LEVELS.map((level) => (
          <option key={level} value={String(level)}>
            {t("canvasToolbar.zoomLevel", { zoom: percent(level) })}
          </option>
        ))}
      </select>

      {size !== null && (
        <output className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {t("canvasToolbar.size", {
            width: Math.round(size.width),
            height: Math.round(size.height),
            zoom: percent(size.zoom),
          })}
        </output>
      )}
    </div>
  );
}

/** The canvas width in pixels; typing another width and pressing Enter shows that width. */
function CustomWidth({
  width,
  onChange,
}: {
  readonly width: number;
  readonly onChange: (viewport: Viewport) => void;
}) {
  const [value, setValue] = useState(String(width));
  const id = useId();
  const commit = () => {
    const typed = Math.round(Number(value));
    if (!Number.isFinite(typed) || value.trim() === "") {
      setValue(String(width));
      return;
    }
    const next = Math.min(CUSTOM_WIDTH.max, Math.max(CUSTOM_WIDTH.min, typed));
    setValue(String(next));
    if (next !== width) {
      onChange(viewportFor(next));
    }
  };
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <label htmlFor={id} className="sr-only">
        {t("canvasToolbar.width")}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={CUSTOM_WIDTH.min}
        max={CUSTOM_WIDTH.max}
        className={cn(fieldControlClass, "w-20 text-right")}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
          } else if (event.key === "Escape") {
            setValue(String(width));
          }
        }}
      />
      <span aria-hidden>{t("canvasToolbar.px")}</span>
    </div>
  );
}
