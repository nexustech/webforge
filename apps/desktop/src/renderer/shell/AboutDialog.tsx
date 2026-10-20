import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { AppInfo } from "../../shared/ipc-contract.js";
import { useCommandRegistry } from "./command-context.js";

/** Help → About Webforge: the app's name and version. Registers its own command. */
export function AboutDialog({ info }: { readonly info: AppInfo }) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      registry.register({
        id: "help.about",
        label: t("command.about"),
        menu: "help",
        run: () => setOpen(true),
      }),
    [registry],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{info.name}</DialogTitle>
          <DialogDescription>{t("app.version", { version: info.version })}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
