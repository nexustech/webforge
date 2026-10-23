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
} from "@webforge/editor-ui";
import type { CanvasSize, Viewport } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { PageId } from "@webforge/model";
import {
  ChevronDownIcon,
  MonitorIcon,
  RotateCwIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { type CanvasPreferences, DEVICE_SIZE } from "../../shared/ipc/prefs.js";
import {
  DEVICE_WIDTHS,
  type DeviceView,
  rotatedWidth,
  viewportFor,
  widthOf,
} from "./canvas-size.js";
import { type CanvasZoom, ZOOM_LEVELS } from "./canvas-view.js";
import { DeviceDialog, type NewDevice } from "./DeviceDialog.js";
import { useMenuDialog } from "./use-menu-dialog.js";

/** The narrowest and widest custom canvas width. */
const CUSTOM_WIDTH = DEVICE_SIZE;

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

/** A scale as a whole percentage: 0.64 → 64. */
const percent = (zoom: number) => Math.round(zoom * 100);

/**
 * The canvas toolbar (F-ED-8, UI1): which page the canvas shows, Desktop · Tablet · Mobile or a
 * custom width, the zoom, the View menu (F-ED-25), and the page's size and scale ("1280 × 879 @
 * 64%"), which opens the device list, the person's own devices and *Add device…* included.
 * Changing any of them is never an undo step (U6).
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
  return (
    <div
      role="toolbar"
      aria-label={t("canvasToolbar.label")}
      // Text in the toolbar's own colour: muted text is under 4.5:1 on the toolbar.
      className="flex h-9 shrink-0 items-center gap-2 border-b border-border-strong bg-toolbar px-2 text-foreground"
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
      <RotateButton
        width={widthOf(viewport)}
        devices={canvas.devices}
        onViewportChange={onViewportChange}
      />

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

      <ViewMenu canvas={canvas} onCanvasChange={onCanvasChange} />

      <DeviceMenu
        size={size}
        canvas={canvas}
        onCanvasChange={onCanvasChange}
        onViewportChange={onViewportChange}
      />
    </div>
  );
}

/**
 * Rotate (F-ED-25, UX-8): a device's height as the canvas's width, and back. Off for a width that
 * is no device's.
 */
function RotateButton({
  width,
  devices,
  onViewportChange,
}: {
  readonly width: number;
  readonly devices: CanvasPreferences["devices"];
  readonly onViewportChange: (viewport: Viewport) => void;
}) {
  const rotated = rotatedWidth(width, devices);
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={t("canvasToolbar.rotate")}
      title={t("canvasToolbar.rotate")}
      disabled={rotated === undefined}
      onClick={() => {
        if (rotated !== undefined) onViewportChange(viewportFor(rotated));
      }}
    >
      <RotateCwIcon />
    </Button>
  );
}

/** The View menu (F-ED-25, UX-7): what the canvas shows besides the page. */
function ViewMenu({
  canvas,
  onCanvasChange,
}: Pick<CanvasToolbarProps, "canvas" | "onCanvasChange">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          {t("canvasToolbar.view")}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
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
  );
}

/**
 * The page's size and scale; a click lists the devices to show the page at (F-ED-25, UX-8):
 * Desktop, Tablet and Mobile, the person's own, and *Add device…*.
 */
function DeviceMenu({
  size,
  canvas,
  onCanvasChange,
  onViewportChange,
}: Pick<CanvasToolbarProps, "size" | "canvas" | "onCanvasChange" | "onViewportChange">) {
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
            size="sm"
            variant="ghost"
            className="ml-auto text-xs whitespace-nowrap tabular-nums"
            aria-label={
              readout === undefined
                ? t("canvasToolbar.devices")
                : t("canvasToolbar.sizeButton", { size: readout })
            }
          >
            {/* Not an <output>: a live region would read out every size change while panels resize. */}
            {readout ?? t("canvasToolbar.devices")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={dialog.onCloseAutoFocus}>
          {DEVICES.map(({ id, icon: Icon }) => (
            <DropdownMenuItem key={id} onSelect={() => onViewportChange(id)}>
              <Icon aria-hidden />
              {t("canvasToolbar.deviceWidth", {
                name: t(`device.${id}`),
                width: DEVICE_WIDTHS[id],
              })}
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
          <DropdownMenuItem onSelect={() => dialog.choose("add")}>
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
    const next = Math.min(CUSTOM_WIDTH.max, Math.max(CUSTOM_WIDTH.min, typed));
    setValue(String(next));
    if (next !== width) {
      onChange(viewportFor(next));
    }
  };
  return (
    <div className="flex items-center gap-1 text-xs">
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
