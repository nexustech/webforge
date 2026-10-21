import { t } from "@webforge/i18n";
import { useEffect, useState, useSyncExternalStore } from "react";
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
  const [open, setOpen] = useState(false);
  const site = useSyncExternalStore(
    session.history.document.subscribe,
    session.history.document.getState,
  );

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.siteSettings,
        label: t("site.settings.command"),
        menu: "file",
        run: () => setOpen(true),
      }),
    [registry],
  );

  return (
    <SiteSettingsDialog
      open={open}
      site={site}
      onSave={(settings) => {
        saveSiteSettings(session, settings);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
