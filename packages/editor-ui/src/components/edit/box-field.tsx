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
  const sizes = sides.map((side) => box[side.value] ?? DEFAULT);
  const [same, setSame] = useState(() => sizes.every((size) => size === sizes[0]));
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
            onChange={(next) => setSame(next === true)}
            onCommit={() => undefined}
          />
          <label id={`${sameId}-label`} htmlFor={sameId} className="text-xs text-muted-foreground">
            {t("editPanel.box.same")}
          </label>
        </div>
      ) : null}
      {same || sides.length === 1
        ? choices(
            `${id}-all`,
            labelId,
            sizes.every((size) => size === sizes[0]) ? (sizes[0] ?? DEFAULT) : "",
            (token) =>
              onChange(
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
                  onChange(withSides(box, [side.value], token)),
                )}
              </div>
            );
          })}
    </div>
  );
}
