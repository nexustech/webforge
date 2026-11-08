import { cn } from "@webforge/editor-ui";
import type { ThemeTokens } from "@webforge/model";
import { oklchCss } from "@webforge/themes";
import { presetLabel } from "./template-labels.js";

/** The colours a theme's swatch row shows: its page, then its brand colours. */
const SWATCHES = ["base-100", "primary", "secondary", "accent"] as const;

/** A theme preset to choose: its name and a row of its main colours. */
export function ThemeOption({
  preset,
  name,
  checked,
  onChoose,
}: {
  readonly preset: ThemeTokens;
  readonly name: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
}) {
  const { colors } = preset;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-sm",
        "hover:bg-hover has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
      )}
    >
      <input
        type="radio"
        name={name}
        value={preset.preset}
        checked={checked}
        onChange={onChoose}
        className="sr-only"
      />
      <span className="flex shrink-0" aria-hidden>
        {SWATCHES.map((role) => (
          <span
            key={role}
            className="-ml-1 size-4 rounded-full border border-border-strong first:ml-0"
            style={{ backgroundColor: oklchCss(colors[role]) }}
          />
        ))}
      </span>
      <span className="truncate">{presetLabel(preset.preset)}</span>
    </label>
  );
}
