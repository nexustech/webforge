import { combineForms, FieldRenderersProvider, FormDialog } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { OpenSettings } from "../editor/settings-registry.js";
import { codeField } from "../fields/index.js";

/** The fields Settings draws the app's way: the site's code (3.9). */
const RENDERERS = { code: codeField() };

/** Props of {@link SettingsDialog}. */
export type SettingsDialogProps = {
  readonly open: boolean;
  /** Its parts, as they opened: App's, then This site's. */
  readonly parts: readonly OpenSettings[];
  /** The section it opens on, as `part:group` ("site:general"); its first when left out. */
  readonly initialGroup?: string | undefined;
  /** Saved: each part has kept its own. */
  readonly onSaved: () => void;
  readonly onCancel: () => void;
};

/**
 * Settings (LF-12): one dialog for the app and the open site, its sections listed down the side
 * under *App* and *This site*. Save checks every part and hands each its own: the person's
 * preferences are saved as they are, never an undo step; the site's settings are one undo step.
 */
export function SettingsDialog({
  open,
  parts,
  initialGroup,
  onSaved,
  onCancel,
}: SettingsDialogProps) {
  const { spec, initial } = combineForms(parts.map((part) => part.form));
  return (
    <FieldRenderersProvider renderers={RENDERERS}>
      <FormDialog
        open={open}
        title={t("settings.title")}
        description={t("settings.description")}
        confirm={t("settings.save")}
        spec={spec}
        initial={initial}
        groupsLabel={t("settings.sections")}
        {...(initialGroup === undefined ? {} : { initialGroup })}
        size="xl"
        onSave={(output) => {
          for (const part of parts) part.save(output[part.form.id]);
          onSaved();
        }}
        onCancel={onCancel}
      />
    </FieldRenderersProvider>
  );
}
