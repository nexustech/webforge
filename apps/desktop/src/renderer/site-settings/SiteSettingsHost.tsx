import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { SiteSettingsDialog } from "./SiteSettingsDialog.js";
import { saveSiteSettings } from "./settings-form.js";

/** Props of {@link SiteSettingsHost}. */
export type SiteSettingsHostProps = {
  readonly session: EditorSession;
};

/**
 * File → Site Settings… (F-SET-1), also in the command box: opens {@link SiteSettingsDialog} on the
 * open site and saves what it returns as one undo step.
 */
export function SiteSettingsHost({ session }: SiteSettingsHostProps) {
  const registry = useCommandRegistry();
  // The dialog, and the site as it was when it opened (R9): read then, not as this draws.
  const [dialog, setDialog] = useState(() => ({
    open: false,
    site: session.history.document.getState(),
  }));

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.siteSettings,
        label: t("site.settings.command"),
        menu: "file",
        run: () => setDialog({ open: true, site: session.history.document.getState() }),
      }),
    [registry, session],
  );

  return (
    <SiteSettingsDialog
      open={dialog.open}
      site={dialog.site}
      onSave={(settings) => {
        saveSiteSettings(session, settings);
        setDialog((shown) => ({ ...shown, open: false }));
      }}
      onCancel={() => setDialog((shown) => ({ ...shown, open: false }))}
    />
  );
}
