import { ToggleGroup, ToggleGroupItem } from "@webforge/editor-ui";
import type { EditorMode } from "@webforge/engine";
import { t } from "@webforge/i18n";

/** Props of {@link ModeToggle}. */
export type ModeToggleProps = {
  readonly mode: EditorMode;
  readonly onModeChange: (mode: EditorMode) => void;
};

/**
 * The title bar's Design | Content switch (M3, UI1): Design changes the layout, Content edits text
 * and images only. It changes at once, without a reload.
 */
export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={mode}
      aria-label={t("shell.mode")}
      // Clicking the chosen mode again would clear the value; a mode is always on.
      onValueChange={(value) => {
        if (value === "design" || value === "content") {
          onModeChange(value);
        }
      }}
    >
      <ToggleGroupItem value="design">{t("shell.mode.design")}</ToggleGroupItem>
      <ToggleGroupItem value="content">{t("shell.mode.content")}</ToggleGroupItem>
    </ToggleGroup>
  );
}
