import { t } from "@webforge/i18n";
import { PipetteIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";
import {
  areaAt,
  type Hsv,
  hsvFor,
  hsvToHex,
  moveHue,
  moveInArea,
  parseHex,
  shownHue,
} from "../../lib/colour.js";
import { fieldControlClass } from "../edit/text-field.js";
import { Button } from "./button.js";
import { WithTooltip } from "./tooltip.js";

/** Chromium's eyedropper, where the window has it (5.26): a colour from anywhere on the screen. */
type EyeDropperApi = new () => { open(): Promise<{ readonly sRGBHex: string }> };

/** The eyedropper, if this window has one. */
function eyeDropper(): EyeDropperApi | undefined {
  const api = (globalThis as { EyeDropper?: unknown }).EyeDropper;
  return typeof api === "function" ? (api as EyeDropperApi) : undefined;
}

/** Props of {@link ColourPicker}. */
export type ColourPickerProps = {
  /** The swatch button's id, for a `<label htmlFor>`. */
  readonly id?: string;
  /** The colour, as a six-digit hex code (`#1a7f5a`). */
  readonly value: string;
  /** What names the swatch button: the id of the field's label, or its name. */
  readonly "aria-labelledby"?: string | undefined;
  readonly "aria-label"?: string | undefined;
  /** More about the colour, such as its contrast warnings. */
  readonly "aria-describedby"?: string | undefined;
  readonly disabled?: boolean;
  /** The swatch button's size and place ("h-7 w-9"). */
  readonly className?: string;
  /**
   * Colours to offer as swatches, each a six-digit hex code: the site's one-off colours in a colour
   * field (TC-2, #1219). Read each time it opens, so a colour used since is there.
   */
  readonly colours?: (() => readonly string[]) | undefined;
  /**
   * Offers *Add to Your Colours…* (TC-3, #1221): the picker closes on the colour shown, chosen as
   * any close chooses it, then gives it to this, to make it one of the person's colours.
   */
  readonly onAddToColours?: ((hex: string) => void) | undefined;
  /**
   * The colour chosen, once, when the picker closes on a colour other than the one it opened on:
   * one change, so one undo step. Nothing while it is being chosen, nor when Escape closes it.
   */
  onChoose(hex: string): void;
  /**
   * Each colour shown while it is being chosen, as it's dragged, typed or picked (5.30): for the
   * page to show it at once, before it is chosen. Never a change: {@link onChoose} still makes that.
   */
  readonly onPreview?: ((hex: string) => void) | undefined;
  /**
   * The picker closed after {@link onPreview}: `chosen` if it was on another colour, given to
   * {@link onChoose} just before; else (Escape, or back where it began) the page shows its own again.
   */
  readonly onPreviewEnd?: ((chosen: boolean) => void) | undefined;
};

/**
 * Webforge's own colour picker (5.26, OL-19): a swatch that opens a saturation and brightness area,
 * a hue slider, the hex code and, where the window has one, the eyedropper, the same on Windows and
 * macOS. Each works by keyboard and is named for a screen reader. The colour it opened on shows
 * beside the one shown, and goes back to it (#1408). The colour is chosen once, when it closes by
 * Done or a click away; Cancel and Escape leave it as it was. A hex code that isn't one is refused,
 * saying why. Where the page can show a colour at once, each one shown is offered to it while it's
 * chosen (5.30).
 */
export function ColourPicker({
  id,
  value,
  "aria-labelledby": labelledBy,
  "aria-label": label,
  "aria-describedby": describedBy,
  disabled = false,
  className,
  colours,
  onAddToColours,
  onChoose,
  onPreview,
  onPreviewEnd,
}: ColourPickerProps) {
  const codeId = useId();
  const hexId = useId();
  const errorId = useId();
  const coloursId = useId();
  const [open, setOpen] = useState(false);
  // The colour being chosen, as the picker holds it: its hue kept on a grey.
  const [held, setHeld] = useState<Hsv | undefined>(undefined);
  // What's typed in the hex box, until it's used; refused with a reason when it isn't a code.
  const [typed, setTyped] = useState<string | undefined>(undefined);
  const [refused, setRefused] = useState(false);
  // The colours offered, as they were when it opened.
  const [offered, setOffered] = useState<readonly string[]>([]);
  // The colour it opened on, shown as "before" (#1408), and whether the person went back to it with
  // Escape or Cancel.
  const [opened, setOpened] = useState(value);
  const cancelled = useRef(false);
  // Whether a colour has been shown to `onPreview` since it opened.
  const previewed = useRef(false);
  // The latest `onPreviewEnd`, for a picker that goes away while it's open: its preview ends too.
  const previewEnd = useRef(onPreviewEnd);
  useEffect(() => {
    previewEnd.current = onPreviewEnd;
  });
  useEffect(
    () => () => {
      if (previewed.current) previewEnd.current?.(false);
    },
    [],
  );
  // While the eyedropper is out, a click on the screen picks a colour; it doesn't close the picker.
  const picking = useRef(false);
  const area = useRef<HTMLDivElement>(null);

  const colour = open && held !== undefined ? held : hsvFor(value, undefined);
  const hex = hsvToHex(colour);

  /** Shows `next`: the area, slider, code and swatch follow. */
  const show = (next: Hsv) => {
    setHeld(next);
    setTyped(undefined);
    setRefused(false);
    if (onPreview !== undefined) {
      previewed.current = true;
      onPreview(hsvToHex(next));
    }
  };

  const onOpenChange = (next: boolean) => {
    if (next) {
      setOpened(value);
      cancelled.current = false;
      previewed.current = false;
      setHeld(hsvFor(value, undefined));
      setTyped(undefined);
      setRefused(false);
      setOffered(colours?.() ?? []);
      setOpen(true);
      return;
    }
    setOpen(false);
    const chosen = shown();
    const choosing = !cancelled.current && chosen !== opened;
    if (choosing) onChoose(chosen);
    if (previewed.current) {
      previewed.current = false;
      onPreviewEnd?.(choosing);
    }
    setHeld(undefined);
    setTyped(undefined);
  };

  /** The colour shown: a code still in its box counts, as a click away closes before it's left. */
  const shown = () => (typed === undefined ? undefined : parseHex(typed)) ?? hex;

  /**
   * Closes on the colour shown, choosing it as a click away does, and gives it to `then`: not on a
   * code in its box that isn't one, which is refused, saying why, as Enter refuses it.
   */
  const done = (then?: (hex: string) => void) => {
    if (typed !== undefined && parseHex(typed) === undefined) {
      setRefused(true);
      return;
    }
    const chosen = shown();
    onOpenChange(false);
    then?.(chosen);
  };

  /** Closes on the colour it opened on, as Escape does (#1408). */
  const cancel = () => {
    cancelled.current = true;
    onOpenChange(false);
  };

  /** Uses what's typed in the hex box, or refuses it, saying why. */
  const applyTyped = () => {
    if (typed === undefined) return;
    const parsed = parseHex(typed);
    if (parsed === undefined) {
      setRefused(true);
      return;
    }
    show(hsvFor(parsed, undefined));
  };

  /** The area's colour under the pointer. */
  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = area.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0 || box.height === 0) return;
    show(
      areaAt(
        colour,
        (event.clientX - box.left) / box.width,
        (event.clientY - box.top) / box.height,
      ),
    );
  };

  /** The hue under the pointer on its slider. */
  const hueAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    show({ ...colour, h: Math.round(x * 359) });
  };

  /** A drag from a pointer press: it keeps the pointer, so it goes on outside the area. */
  const drag = (
    event: PointerEvent<HTMLDivElement>,
    at: (event: PointerEvent<HTMLDivElement>) => void,
  ) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    at(event);
  };
  const dragging = (
    event: PointerEvent<HTMLDivElement>,
    at: (event: PointerEvent<HTMLDivElement>) => void,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) at(event);
  };

  const byKey =
    (move: (colour: Hsv, key: string, shift: boolean) => Hsv | undefined) =>
    (event: KeyboardEvent<HTMLDivElement>) => {
      const next = move(colour, event.key, event.shiftKey);
      if (next === undefined) return;
      event.preventDefault();
      show(next);
    };

  const EyeDropper = eyeDropper();
  const pick = () => {
    if (EyeDropper === undefined) return;
    picking.current = true;
    new EyeDropper()
      .open()
      .then(
        (picked) => {
          const parsed = parseHex(picked.sRGBHex);
          if (parsed !== undefined) show(hsvFor(parsed, undefined));
        },
        // Cancelled (Escape, or a click away): the colour stays as it was.
        () => undefined,
      )
      .finally(() => {
        picking.current = false;
      });
  };

  const saturation = Math.round(colour.s * 100);
  const brightness = Math.round(colour.v * 100);
  const hue = shownHue(colour.h);
  const thumb = "pointer-events-none absolute size-3.5 rounded-full border-2 border-white shadow";
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-labelledby={labelledBy}
          aria-label={label}
          aria-describedby={[codeId, describedBy].filter(Boolean).join(" ")}
          disabled={disabled}
          data-slot="colour-picker-trigger"
          className={cn(fieldControlClass, "h-7 w-9 shrink-0 cursor-pointer p-0.5", className)}
        >
          <span
            aria-hidden
            className="block size-full rounded-sm border border-border"
            style={{ backgroundColor: open ? hex : value }}
          />
          <span id={codeId} className="sr-only">
            {open ? hex : value}
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="colour-picker"
          aria-label={t("ui.colourPicker.label")}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 flex w-60 flex-col gap-3 rounded-md border border-border-strong bg-popover p-3",
            "text-popover-foreground shadow-lg outline-none animate-in fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
          // The focus starts on the area, not on "before" above it.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            area.current?.focus();
          }}
          onEscapeKeyDown={() => {
            cancelled.current = true;
          }}
          onPointerDownOutside={(event) => {
            if (picking.current) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (picking.current) event.preventDefault();
          }}
        >
          {/* The colour it opened on beside the one shown (#1408): "before" goes back to it. */}
          <div className="grid grid-cols-2 gap-1.5 text-2xs text-muted-foreground">
            <button
              type="button"
              aria-label={t("ui.colourPicker.beforeName", { hex: opened })}
              data-slot="colour-picker-before"
              className="flex cursor-pointer flex-col gap-0.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => show(hsvFor(opened, undefined))}
            >
              <span aria-hidden>{t("ui.colourPicker.before")}</span>
              <span
                aria-hidden
                className="block h-6 w-full rounded-sm border border-border"
                style={{ backgroundColor: opened }}
              />
            </button>
            <div
              role="img"
              aria-label={t("ui.colourPicker.nowName", { hex })}
              data-slot="colour-picker-now"
              className="flex flex-col gap-0.5"
            >
              <span aria-hidden>{t("ui.colourPicker.now")}</span>
              <span
                aria-hidden
                className="block h-6 w-full rounded-sm border border-border"
                style={{ backgroundColor: hex }}
              />
            </div>
          </div>
          <div
            ref={area}
            role="slider"
            tabIndex={0}
            aria-label={t("ui.colourPicker.area")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={saturation}
            aria-valuetext={t("ui.colourPicker.areaValue", { saturation, brightness })}
            data-slot="colour-picker-area"
            className="relative h-36 w-full cursor-crosshair touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              backgroundColor: hsvToHex({ h: colour.h, s: 1, v: 1 }),
              backgroundImage:
                "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
            }}
            onPointerDown={(event) => drag(event, pointAt)}
            onPointerMove={(event) => dragging(event, pointAt)}
            onKeyDown={byKey(moveInArea)}
          >
            <span
              aria-hidden
              className={cn(thumb, "-translate-x-1/2 -translate-y-1/2")}
              style={{ left: `${colour.s * 100}%`, top: `${(1 - colour.v) * 100}%` }}
            />
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-label={t("ui.colourPicker.hue")}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={hue}
            aria-valuetext={t("ui.colourPicker.hueValue", { degrees: hue })}
            data-slot="colour-picker-hue"
            className="relative h-3.5 w-full cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              backgroundImage:
                "linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)",
            }}
            onPointerDown={(event) => drag(event, hueAt)}
            onPointerMove={(event) => dragging(event, hueAt)}
            onKeyDown={byKey(moveHue)}
          >
            <span
              aria-hidden
              className={cn(thumb, "top-0 -translate-x-1/2")}
              style={{ left: `${(hue / 359) * 100}%` }}
            />
          </div>
          <div className="flex items-start gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor={hexId} className="sr-only">
                {t("ui.colourPicker.hex")}
              </label>
              <input
                id={hexId}
                className={cn(fieldControlClass, "h-7 w-full font-mono text-xs")}
                value={typed ?? hex}
                spellCheck={false}
                aria-invalid={refused || undefined}
                aria-describedby={refused ? errorId : undefined}
                onChange={(event) => {
                  setTyped(event.currentTarget.value);
                  setRefused(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyTyped();
                  }
                }}
                onBlur={applyTyped}
              />
            </div>
            {EyeDropper === undefined ? null : (
              <WithTooltip tooltip={t("ui.colourPicker.pick")}>
                <button
                  type="button"
                  aria-label={t("ui.colourPicker.pick")}
                  className={cn(
                    fieldControlClass,
                    "flex size-7 shrink-0 items-center justify-center p-0 [&_svg]:size-4",
                  )}
                  onClick={pick}
                >
                  <PipetteIcon aria-hidden />
                </button>
              </WithTooltip>
            )}
          </div>
          <p
            id={errorId}
            aria-live="polite"
            className={cn("m-0 text-2xs text-destructive-text", refused ? undefined : "sr-only")}
          >
            {refused ? t("ui.colourPicker.hexRefused") : ""}
          </p>
          {offered.length === 0 ? null : (
            <div className="flex flex-col gap-1">
              <span id={coloursId} className="text-2xs text-muted-foreground">
                {t("ui.colourPicker.used")}
              </span>
              <ul aria-labelledby={coloursId} className="m-0 flex list-none flex-wrap gap-1 p-0">
                {offered.map((each) => (
                  <li key={each}>
                    <button
                      type="button"
                      aria-label={each}
                      aria-pressed={each === hex}
                      className={cn(
                        fieldControlClass,
                        "size-6 cursor-pointer p-0.5 aria-pressed:ring-2 aria-pressed:ring-ring",
                      )}
                      onClick={() => show(hsvFor(each, undefined))}
                    >
                      <span
                        aria-hidden
                        className="block size-full rounded-sm border border-border"
                        style={{ backgroundColor: each }}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {onAddToColours === undefined ? null : (
            <button
              type="button"
              className={cn(fieldControlClass, "h-7 w-auto self-start px-2 text-xs")}
              onClick={() => done(onAddToColours)}
            >
              {t("ui.colourPicker.addToColours")}
            </button>
          )}
          {/* What Escape and a click away do, said as buttons (#1408). */}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={cancel}>
              {t("ui.colourPicker.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={() => done()}>
              {t("ui.colourPicker.done")}
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
