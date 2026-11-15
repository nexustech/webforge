import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  fieldControlClass,
  ToggleGroup,
  ToggleGroupItem,
  useMenuDialog,
} from "@webforge/editor-ui";
import type { CanvasSize, Viewport } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { PageId } from "@webforge/model";
import {
  ChevronDownIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  RotateCwIcon,
  SmartphoneIcon,
  TabletIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { type CanvasPreferences, DEVICE_SIZE, MAX_DEVICES } from "../../shared/ipc/prefs.js";
import {
  DESKTOP_SIZES,
  DEVICE_WIDTHS,
  type DeviceView,
  rotatedWidth,
  viewportFor,
  widthOf,
} from "./canvas-size.js";
import { type CanvasZoom, ZOOM_LEVELS, zoomStep } from "./canvas-view.js";
import { DeviceDialog, type NewDevice, WidthDialog } from "./DeviceDialog.js";
import { useFitLevel } from "./toolbar-fit.js";

const DEVICES = [
  { id: "desktop", icon: MonitorIcon },
  { id: "tablet", icon: TabletIcon },
  { id: "mobile", icon: SmartphoneIcon },
] as const satisfies readonly { id: DeviceView; icon: unknown }[];

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
  /** The View menu's options and the person's own devices (F-ED-25). */
  readonly canvas: CanvasPreferences;
  readonly onCanvasChange: (canvas: CanvasPreferences) => void;
};

/** The View menu's options, in menu order. */
const VIEW_OPTIONS = [
  { key: "showOutlines", label: "canvasToolbar.view.outlines" },
  { key: "spacingOnHover", label: "canvasToolbar.view.spacing" },
  { key: "elementNames", label: "canvasToolbar.view.names" },
  { key: "extraBottomSpace", label: "canvasToolbar.view.extraSpace" },
] as const satisfies readonly { key: keyof CanvasPreferences; label: string }[];

/**
 * What the toolbar moves into its View menu as it narrows (#1008), first to last: the size
 * read-out (its device list stays, behind an icon), the width box, then Zoom In, Zoom Out and
 * Rotate. Desktop, Tablet and Mobile, the zoom and the page never leave it.
 */
const FIT = { readout: 1, width: 2, zoom: 3 } as const;

/** A scale as a whole percentage: 0.64 → 64. */
const percent = (zoom: number) => Math.round(zoom * 100);

/**
 * The canvas toolbar (F-ED-8, UI1, LF-4): on the left, zoom in and out, Rotate, the zoom (Fit
 * first), the View menu (F-ED-25), a custom width and the page's size and scale ("1280 × 879 @
 * 64%"), which opens the device list, the person's own devices and *Add device…* included; on the
 * right, which page the canvas shows and Desktop · Tablet · Mobile. Changing any of them is never
 * an undo step (U6). Too narrow for all of it, it moves controls into its View menu ({@link FIT}).
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
  canvas,
  onCanvasChange,
}: CanvasToolbarProps) {
  const pageId = useId();
  const zoomId = useId();
  const toolbar = useRef<HTMLDivElement>(null);
  const fit = useFitLevel(toolbar, FIT.zoom);
  const scale = typeof zoom === "number" ? zoom : (size?.zoom ?? 1);
  const width = widthOf(viewport, size?.width);
  const rotated = rotatedWidth(width, canvas.devices);
  const rotate = () => {
    if (rotated !== undefined) onViewportChange(viewportFor(rotated));
  };
  return (
    <div
      ref={toolbar}
      role="toolbar"
      aria-label={t("canvasToolbar.label")}
      // Text in the toolbar's own colour: muted text is under 4.5:1 on the toolbar. Its overflow is
      // hidden for a moment only, until the View menu takes what doesn't fit.
      className="flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b border-border-strong bg-toolbar px-2 text-foreground"
    >
      {/* LF-4: the zoom, Rotate, Fit, View and the size on the left; page and device on the right. */}
      {fit < FIT.zoom && (
        <>
          {zoomSteps(scale).map(({ direction, label, Icon, next, disabled }) => (
            <Button
              key={direction}
              type="button"
              size="icon"
              variant="ghost"
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => onZoomChange(next)}
            >
              <Icon />
            </Button>
          ))}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("canvasToolbar.rotate")}
            title={t("canvasToolbar.rotate")}
            disabled={rotated === undefined}
            onClick={rotate}
          >
            <RotateCwIcon />
          </Button>
        </>
      )}

      <label htmlFor={zoomId} className="sr-only">
        {t("canvasToolbar.zoom")}
      </label>
      <select
        id={zoomId}
        className={cn(fieldControlClass, "w-28 shrink-0")}
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

      <ViewMenu
        canvas={canvas}
        onCanvasChange={onCanvasChange}
        moved={{
          ...(fit >= FIT.zoom
            ? { zoom: { scale, onZoomChange }, rotate: { rotated, rotate } }
            : {}),
          ...(fit >= FIT.width ? { width: true } : {}),
        }}
        width={width}
        onViewportChange={onViewportChange}
      />

      {fit < FIT.width && (
        // Keyed by the width, so it shows a width chosen elsewhere (a device, undo).
        <CustomWidth key={width} width={width} onChange={onViewportChange} />
      )}
      <DeviceMenu
        compact={fit >= FIT.readout}
        size={size}
        canvas={canvas}
        onCanvasChange={onCanvasChange}
        onViewportChange={onViewportChange}
      />
      <div
        className={cn("ml-auto flex items-center gap-2", fit >= FIT.zoom ? "min-w-0" : "shrink-0")}
      >
        <label htmlFor={pageId} className="sr-only">
          {t("canvasToolbar.page")}
        </label>
        <select
          id={pageId}
          // Narrower, at the narrowest, rather than the toolbar cutting anything off.
          className={cn(
            fieldControlClass,
            "w-44",
            fit >= FIT.zoom ? "min-w-20 shrink" : "shrink-0",
          )}
          value={shownPageId}
          onChange={(event) => {
            const { value } = event.currentTarget;
            const page = pages.find((candidate) => candidate.id === value);
            if (page !== undefined) onShowPage(page.id);
          }}
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title}
            </option>
          ))}
        </select>

        <ToggleGroup
          type="single"
          className="shrink-0"
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
      </div>
    </div>
  );
}

/**
 * Zoom in and zoom out (LF-4), a level at a time from the scale the canvas shows, as the View
 * menu's commands do. Each is off at the largest or the smallest zoom.
 */
function zoomSteps(scale: number) {
  return (["in", "out"] as const).map((direction) => {
    const next = zoomStep(scale, direction);
    return {
      direction,
      label: t(direction === "in" ? "command.zoomIn" : "command.zoomOut"),
      Icon: direction === "in" ? ZoomInIcon : ZoomOutIcon,
      next,
      disabled: Math.abs(next - scale) < 0.005,
    };
  });
}

/** The toolbar's controls the View menu holds while the toolbar is too narrow for them (#1008). */
type MovedControls = {
  readonly zoom?: { readonly scale: number; readonly onZoomChange: (zoom: CanvasZoom) => void };
  /** Rotate (F-ED-25, UX-8): off for a width that is no device's. */
  readonly rotate?: { readonly rotated: number | undefined; readonly rotate: () => void };
  /** The width box, as *Canvas width…*. */
  readonly width?: true;
};

/** The View menu (F-ED-25, UX-7): what the canvas shows besides the page. */
function ViewMenu({
  canvas,
  onCanvasChange,
  moved,
  width,
  onViewportChange,
}: Pick<CanvasToolbarProps, "canvas" | "onCanvasChange" | "onViewportChange"> & {
  readonly moved: MovedControls;
  /** The canvas's width now, for *Canvas width…*. */
  readonly width: number;
}) {
  const [widthOpen, setWidthOpen] = useState(false);
  const dialog = useMenuDialog<"width">(() => setWidthOpen(true));
  const { zoom, rotate } = moved;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost">
            {t("canvasToolbar.view")}
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={dialog.onCloseAutoFocus}>
          {zoom !== undefined &&
            zoomSteps(zoom.scale).map(({ direction, label, Icon, next, disabled }) => (
              <DropdownMenuItem
                key={direction}
                disabled={disabled}
                // Kept open, to zoom again.
                onSelect={(event) => {
                  event.preventDefault();
                  zoom.onZoomChange(next);
                }}
              >
                <Icon aria-hidden />
                {label}
              </DropdownMenuItem>
            ))}
          {rotate !== undefined && (
            <DropdownMenuItem disabled={rotate.rotated === undefined} onSelect={rotate.rotate}>
              <RotateCwIcon aria-hidden />
              {t("canvasToolbar.rotate")}
            </DropdownMenuItem>
          )}
          {moved.width && (
            <DropdownMenuItem onSelect={() => dialog.choose("width")}>
              {t("canvasToolbar.widthItem")}
            </DropdownMenuItem>
          )}
          {(zoom !== undefined || rotate !== undefined || moved.width) && <DropdownMenuSeparator />}
          {VIEW_OPTIONS.map(({ key, label }) => (
            <DropdownMenuCheckboxItem
              key={key}
              checked={canvas[key]}
              // Kept open, so several can be turned on in one go.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => onCanvasChange({ ...canvas, [key]: checked === true })}
            >
              {t(label)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Mounted at every width: a window widened while it's open keeps it open (#1008). */}
      <WidthDialog
        open={widthOpen}
        width={width}
        onShow={(next) => {
          setWidthOpen(false);
          if (next !== width) onViewportChange(viewportFor(next));
        }}
        onCancel={() => setWidthOpen(false)}
      />
    </>
  );
}

/**
 * The page's size and scale; a click lists the devices to show the page at (F-ED-25, UX-8):
 * Desktop, Tablet and Mobile, the person's own, and *Add device…*.
 */
function DeviceMenu({
  compact,
  size,
  canvas,
  onCanvasChange,
  onViewportChange,
}: Pick<CanvasToolbarProps, "size" | "canvas" | "onCanvasChange" | "onViewportChange"> & {
  /** An icon in place of the read-out, in a narrow toolbar (#1008); its name still says the size. */
  readonly compact: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const dialog = useMenuDialog<"add">(() => setAdding(true));
  const readout =
    size === null
      ? undefined
      : t("canvasToolbar.size", {
          width: Math.round(size.width),
          height: Math.round(size.height),
          zoom: percent(size.zoom),
        });
  const add = (device: NewDevice) => {
    setAdding(false);
    onCanvasChange({
      ...canvas,
      devices: [...canvas.devices, { id: crypto.randomUUID(), ...device }],
    });
    onViewportChange(viewportFor(device.width));
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size={compact ? "icon" : "sm"}
            variant="ghost"
            className="text-xs whitespace-nowrap tabular-nums"
            title={compact ? (readout ?? t("canvasToolbar.devices")) : undefined}
            aria-label={
              readout === undefined
                ? t("canvasToolbar.devices")
                : t("canvasToolbar.sizeButton", { size: readout })
            }
          >
            {/* Not an <output>: a live region would read out every size change while panels resize. */}
            {compact ? <MonitorSmartphoneIcon /> : (readout ?? t("canvasToolbar.devices"))}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={dialog.onCloseAutoFocus}>
          {DEVICES.map(({ id, icon: Icon }) => (
            <DropdownMenuItem key={id} onSelect={() => onViewportChange(id)}>
              <Icon aria-hidden />
              {id === "desktop"
                ? t("canvasToolbar.desktopFills")
                : t("canvasToolbar.deviceWidth", {
                    name: t(`device.${id}`),
                    width: DEVICE_WIDTHS[id],
                  })}
            </DropdownMenuItem>
          ))}
          {/* Fixed desktop widths, to check particular screens (PH2-18). */}
          {DESKTOP_SIZES.map(({ width }) => (
            <DropdownMenuItem key={width} onSelect={() => onViewportChange(width)}>
              <MonitorIcon aria-hidden />
              {t("canvasToolbar.deviceWidth", { name: t("device.desktop"), width })}
            </DropdownMenuItem>
          ))}
          {canvas.devices.map((device) => (
            <DropdownMenuItem
              key={device.id}
              onSelect={() => onViewportChange(viewportFor(device.width))}
            >
              {t("canvasToolbar.deviceSize", device)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* The preferences keep so many devices; past that, one has to go first. */}
          <DropdownMenuItem
            disabled={canvas.devices.length >= MAX_DEVICES}
            onSelect={() => dialog.choose("add")}
          >
            {t("canvasToolbar.addDevice")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeviceDialog open={adding} onAdd={add} onCancel={() => setAdding(false)} />
    </>
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
    const next = Math.min(DEVICE_SIZE.max, Math.max(DEVICE_SIZE.min, typed));
    setValue(String(next));
    if (next !== width) {
      onChange(viewportFor(next));
    }
  };
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs">
      <label htmlFor={id} className="sr-only">
        {t("canvasToolbar.width")}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={DEVICE_SIZE.min}
        max={DEVICE_SIZE.max}
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
