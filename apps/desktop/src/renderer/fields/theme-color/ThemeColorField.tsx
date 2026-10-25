import { cn, type FieldRendererProps, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { oklchSchema } from "@webforge/model";
import { hexToOklch } from "@webforge/themes";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { hexOf } from "../color/hex.js";

/** Six hex digits, with or without the `#`: what the hex box takes. */
const HEX = /^#?([0-9a-f]{6})$/i;

/**
 * One of the theme's colours in the Theme tab (2.3a, F-DS-2): the system's colour picker and the
 * colour's hex code, each changing it once the person is done (the picker closed, Enter, or the box
 * left), and under them what its contrast with the colours it's used with lacks, below WCAG AA.
 */
export function ThemeColorField({
  id,
  labelId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"themeColor">) {
  const hexId = useId();
  const hexLabelId = useId();
  const warningsId = useId();
  const picker = useRef<HTMLInputElement>(null);
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
  const picked = useEffectEvent((input: HTMLInputElement) => choose(input.value));

  // The picker's colour is used once it closes ("change"), not at every step of a drag ("input").
  // A new colour draws a new picker (its key), which gets its own listener.
  useEffect(() => {
    const input = picker.current;
    if (input === null || hex === "") return;
    const done = () => picked(input);
    input.addEventListener("change", done);
    return () => input.removeEventListener("change", done);
  }, [hex]);

  const warnings = field.warnings;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          // Uncontrolled, so dragging in the picker moves freely; it starts again at a new colour.
          key={hex}
          ref={picker}
          id={id}
          type="color"
          aria-labelledby={labelId}
          aria-describedby={warnings.length === 0 ? undefined : warningsId}
          className={cn(fieldControlClass, "h-7 w-9 shrink-0 cursor-pointer p-0.5")}
          defaultValue={hex}
          disabled={disabled}
        />
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
      </div>
      <ul id={warningsId} aria-live="polite" className="m-0 flex list-none flex-col gap-0.5 p-0">
        {warnings.map((warning) => (
          <li key={warning} className="flex items-start gap-1 text-xs text-foreground">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}
