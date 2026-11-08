import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type LicencesApi, LicencesDialog } from "./LicencesDialog.js";

/**
 * Help → Open-Source Licences: registers its command, and draws {@link LicencesDialog} when it
 * runs. About {appName} opens it too.
 */
export function OpenSourceLicences({ licences }: { readonly licences: LicencesApi }) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.licences,
        label: t("command.licences"),
        menu: "help",
        run: () => setOpen(true),
      }),
    [registry],
  );

  return <LicencesDialog open={open} onOpenChange={setOpen} licences={licences} />;
}
