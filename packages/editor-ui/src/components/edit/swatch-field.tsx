import { TriangleAlertIcon } from "lucide-react";
import { type CSSProperties, useId } from "react";
import { cn } from "../../lib/cn.js";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.js";

/** One colour a {@link SwatchField} offers. */
export type SwatchOption = {
  readonly value: string;
  /** Its name, already translated ("Brand"). */
  readonly label: string;
  /** The colour as CSS, as the site shows it now; none for a choice that has no colour of its own. */
  readonly colour?: string;
};

/** Props of {@link SwatchField}. */
export type SwatchFieldProps = {
  readonly id: string;
  readonly labelId: string;
  readonly options: readonly SwatchOption[];
  readonly value: string | undefined;
  /** One choice, which is one change. */
  readonly onChoose: (value: string) => void;
  /** A problem with the colour chosen, such as too little contrast; already translated. */
  readonly warning?: string | undefined;
};

/**
 * Colours to choose from (UX-25), each as a swatch in the site's own colour with its name: one
 * click is one change. Below them, a warning about the colour chosen, read out when it appears.
 */
export function SwatchField({ id, labelId, options, value, onChoose, warning }: SwatchFieldProps) {
  const warningId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <ToggleGroup
        id={id}
        type="single"
        aria-labelledby={labelId}
        aria-describedby={warning === undefined ? undefined : warningId}
        className="grid w-full grid-cols-2 gap-1"
        value={value ?? ""}
        onValueChange={(next) => {
          if (next !== "") onChoose(next);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-7 justify-start gap-1.5 px-1.5 text-xs"
          >
            <span
              aria-hidden
              data-swatch
              className={cn(
                "size-4 shrink-0 rounded-full border",
                option.colour === undefined
                  ? "border-border-strong"
                  : "border-transparent bg-(--swatch)",
              )}
              style={
                option.colour === undefined
                  ? undefined
                  : ({ "--swatch": option.colour } as CSSProperties)
              }
            />
            <span className="truncate">{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p
        id={warningId}
        aria-live="polite"
        className="m-0 flex items-start gap-1 text-xs text-foreground empty:hidden"
      >
        {warning === undefined ? null : (
          <>
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {warning}
          </>
        )}
      </p>
    </div>
  );
}
