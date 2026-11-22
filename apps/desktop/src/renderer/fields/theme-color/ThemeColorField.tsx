import { ColourPicker, cn, type FieldRendererProps, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n/components";
import { type Oklch, oklchSchema } from "@webforge/model";
import { hexOf, hexToOklch } from "@webforge/themes";
import { TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";

/**
 * What shows a theme colour while it's dragged in the picker (5.30, OL-18): `show` each colour,
 * then `end`, saying whether the last was chosen (a change made through `onChange`) or not.
 */
export type ThemeColorPreview = {
  readonly show: (color: Oklch) => void;
  readonly end: (chosen: boolean) => void;
};

/** Six hex digits, with or without the `#`: what the hex box takes. */
const HEX = /^#?([0-9a-f]{6})$/i;

/**
 * One of the theme's colours in the Theme tab (2.3a, F-DS-2): Webforge's colour picker (5.26) and
 * the colour's hex code, each changing it once the person is done (the picker closed, Enter, or the
 * box left), and under them what its contrast with the colours it's used with lacks, below WCAG AA,
 * with a shade that reads, one click away (#1174). Simple mode's Theme tab leaves the code out
 * (LF-16). With `preview`, the page shows each colour while it's dragged (5.30).
 */
export function ThemeColorField({
  id,
  labelId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
  preview,
}: FieldRendererProps<"themeColor"> & { readonly preview?: ThemeColorPreview | undefined }) {
  const hexId = useId();
  const hexLabelId = useId();
  const warningsId = useId();
  const parsed = oklchSchema.safeParse(value);
  const hex = parsed.success ? hexOf(parsed.data) : "#000000";
  // What's typed in the hex box, until it's used; another colour starts it afresh.
  const [typed, setTyped] = useState<{ readonly from: string; readonly text: string } | null>(null);
  const text = typed?.from === hex ? typed.text : hex;

  /** Uses `next`, a hex code, if it's another colour: one change. */
  const choose = (next: string) => {
    const digits = HEX.exec(next.trim())?.[1]?.toLowerCase();
    setTyped(null);
    if (digits === undefined || `#${digits}` === hex) return;
    onChange(hexToOklch(`#${digits}`));
    onCommit();
  };

  const { warnings, code = true, suggestion } = field;
  const suggested = suggestion === undefined ? undefined : oklchSchema.safeParse(suggestion.value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Its colour is a change once it closes, not at every step of a drag, which only shows
            it (5.30); the stored colour shows again when a change is declined (D7). */}
        <ColourPicker
          id={id}
          value={hex}
          aria-labelledby={labelId}
          aria-describedby={warnings.length === 0 ? undefined : warningsId}
          disabled={disabled}
          onChoose={choose}
          onPreview={preview === undefined ? undefined : (next) => preview.show(hexToOklch(next))}
          onPreviewEnd={preview?.end}
        />
        {code ? (
          <>
            <span id={hexLabelId} className="sr-only">
              {t("colour.hexCode")}
            </span>
            <input
              id={hexId}
              aria-labelledby={`${labelId} ${hexLabelId}`}
              className={cn(fieldControlClass, "h-7 w-auto min-w-0 flex-1 font-mono text-xs")}
              value={text}
              spellCheck={false}
              disabled={disabled}
              onChange={(event) => setTyped({ from: hex, text: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // Used up here: the key would go on to press the button of what opens next (D7's
                  // question, focused on Cancel).
                  event.preventDefault();
                  choose(event.currentTarget.value);
                }
                if (event.key === "Escape" && typed !== null) {
                  event.stopPropagation();
                  setTyped(null);
                }
              }}
              onBlur={(event) => choose(event.currentTarget.value)}
            />
          </>
        ) : null}
      </div>
      <ul id={warningsId} aria-live="polite" className="m-0 flex list-none flex-col gap-0.5 p-0">
        {warnings.map((warning) => (
          <li key={warning} className="flex items-start gap-1 text-xs text-foreground">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {warning}
          </li>
        ))}
      </ul>
      {suggestion === undefined || suggested?.success !== true ? null : (
        <button
          type="button"
          className={cn(
            fieldControlClass,
            "flex h-7 w-auto items-center gap-1.5 self-start px-2 text-xs",
          )}
          disabled={disabled}
          // Which colour's shade: each failing colour has one, in the same words.
          aria-describedby={labelId}
          onClick={() => {
            // As it is: the colour whose contrast was checked, not one rebuilt from text.
            setTyped(null);
            onChange(suggested.data);
            onCommit();
          }}
        >
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-sm border border-border-strong"
            style={{ backgroundColor: hexOf(suggested.data) }}
          />
          {suggestion.label}
        </button>
      )}
    </div>
  );
}
