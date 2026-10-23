import { t } from "@webforge/i18n";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group.js";
import type { FieldRendererProps } from "./field-registry.js";
import { ToggleField } from "./toggle-field.js";

/** The choice that leaves a side unset, so it takes the element's own spacing. */
const DEFAULT = "default";

type Box = Readonly<Record<string, string>>;

function boxOf(value: unknown): Box {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** `box` with each of `sides` set to `token`, or unset for {@link DEFAULT}. */
function withSides(box: Box, sides: readonly string[], token: string): Box {
  const next: Record<string, string> = { ...box };
  for (const side of sides) {
    if (token === DEFAULT) delete next[side];
    else next[side] = token;
  }
  return next;
}

/**
 * Padding or margin per side (1.32): a size for each side, or one for every side at once. Each
 * choice is one change. Turning "Same on every side" on or off changes nothing by itself.
 */
export function BoxField({ id, labelId, field, value, onChange, onCommit }: FieldRendererProps) {
  const box = boxOf(value);
  const sides = field.sides ?? [];
  const sizesOf = (of: Box) => sides.map((side) => of[side.value] ?? DEFAULT);
  const sizes = sizesOf(box);
  const allSame = sizes.every((size) => size === sizes[0]);
  const shown = sizes.join(" ");
  // The mode goes with the sizes it was chosen for, and the sizes this field changed them to.
  // Sizes from elsewhere (another element or device, Undo) start it afresh: every side at once if
  // they are all the same.
  const [mode, setMode] = useState<{
    readonly same: boolean;
    readonly shown: string;
    readonly expected?: string;
  }>({ same: allSame, shown });
  const kept = mode.shown === shown || mode.expected === shown;
  const same = kept ? mode.same : allSame;
  if (mode.shown !== shown) setMode({ same, shown });
  /** Reports `next`, keeping the mode for it. */
  const change = (next: Box) => {
    setMode({ same, shown, expected: sizesOf(next).join(" ") });
    onChange(next);
  };
  const options = [{ label: t("editPanel.box.default"), value: DEFAULT }, ...(field.options ?? [])];

  const choices = (
    choiceId: string,
    labelledBy: string,
    chosen: string,
    choose: (token: string) => void,
  ) => (
    <ToggleGroup
      id={choiceId}
      type="single"
      aria-labelledby={labelledBy}
      className="flex w-full flex-wrap"
      value={chosen}
      onValueChange={(next) => {
        if (next !== "") {
          choose(next);
          onCommit();
        }
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  const sameId = `${id}-same`;
  return (
    <div id={id} className="flex flex-col gap-2">
      {sides.length > 1 ? (
        <div className="flex items-center gap-2">
          <ToggleField
            id={sameId}
            labelId={`${labelId} ${sameId}-label`}
            field={{ kind: "toggle", label: t("editPanel.box.same") }}
            value={same}
            onChange={(next) => setMode({ same: next === true, shown })}
            onCommit={() => undefined}
          />
          <label id={`${sameId}-label`} htmlFor={sameId} className="text-xs text-muted-foreground">
            {t("editPanel.box.same")}
          </label>
        </div>
      ) : null}
      {same || sides.length === 1
        ? choices(`${id}-all`, labelId, allSame ? (sizes[0] ?? DEFAULT) : "", (token) =>
            change(
              withSides(
                box,
                sides.map((side) => side.value),
                token,
              ),
            ),
          )
        : sides.map((side, index) => {
            const sideId = `${id}-${side.value}`;
            return (
              <div key={side.value} className="flex flex-col gap-1">
                <span id={`${sideId}-label`} className="text-2xs text-muted-foreground">
                  {side.label}
                </span>
                {choices(sideId, `${labelId} ${sideId}-label`, sizes[index] ?? DEFAULT, (token) =>
                  change(withSides(box, [side.value], token)),
                )}
              </div>
            );
          })}
    </div>
  );
}
