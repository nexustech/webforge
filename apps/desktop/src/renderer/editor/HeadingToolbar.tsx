import { ToggleGroup, ToggleGroupItem } from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
import { useId } from "react";
import type { ContextualToolbar } from "../shell/contextual-toolbars.js";
import type { EditorSession } from "./editor-session.js";
import { changeField, useFieldValue } from "./field-change.js";

/** A Heading's levels, by its `size` field's values: its size sets its level (h1–h3). */
export const HEADING_LEVELS = [
  { value: "large", label: "headingToolbar.title" },
  { value: "medium", label: "headingToolbar.heading" },
  { value: "small", label: "headingToolbar.subheading" },
] as const satisfies readonly { value: string; label: MessageKey }[];

/**
 * A Heading's level as the canvas toolbar shows it (SP-4): Title · Heading · Subheading, the
 * Heading's own chosen. Choosing one is one change.
 */
export function HeadingLevelToolbar({
  value,
  onChange,
}: {
  /** The Heading's `size`. */
  readonly value: unknown;
  readonly onChange: (size: string) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-xs font-medium">
        {t("headingToolbar.level")}
      </span>
      <ToggleGroup
        type="single"
        aria-labelledby={labelId}
        value={typeof value === "string" ? value : ""}
        onValueChange={(next) => {
          if (next !== "") onChange(next);
        }}
      >
        {HEADING_LEVELS.map((level) => (
          <ToggleGroupItem key={level.value} value={level.value}>
            {t(level.label)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/**
 * The selected Heading's level in the canvas toolbar's centre (SP-4), in `session`: a change is
 * one undo step, "Changed Heading size", as from the Edit panel. `flush` ends a canvas text
 * session first.
 */
export function headingToolbar({
  session,
  flush,
}: {
  readonly session: EditorSession;
  readonly flush: () => void;
}): ContextualToolbar {
  return {
    id: "headingLevel",
    types: ["Heading"],
    component: function HeadingLevel({ nodeId }) {
      return (
        <HeadingLevelToolbar
          value={useFieldValue(session, nodeId, "size")}
          onChange={(size) => changeField(session, flush, nodeId, "size", size)}
        />
      );
    },
  };
}
