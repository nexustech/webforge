import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { AppInfo } from "../../shared/ipc-contract.js";
import { AppMark } from "./AppMark.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/**
 * Help → About Webforge: the app's name and version, and Open-Source Licences (5.3). Registers its
 * own command.
 */
export function AboutDialog({ info }: { readonly info: AppInfo }) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.about,
        label: t("command.about"),
        menu: "help",
        run: () => setOpen(true),
      }),
    [registry],
  );

  return (
    <AboutDialogView
      info={info}
      open={open}
      onOpenChange={setOpen}
      onShowLicences={() => {
        setOpen(false);
        registry.run(COMMAND_IDS.licences);
      }}
    />
  );
}

/** About's dialog itself: the app's icon (#454), name and version, and its licences' button. */
export function AboutDialogView({
  info,
  open,
  onOpenChange,
  onShowLicences,
}: {
  readonly info: AppInfo;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onShowLicences: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader className="items-center gap-2 text-center">
          <AppMark className="size-16" />
          <DialogTitle>{info.name}</DialogTitle>
          <DialogDescription>{t("app.version", { version: info.version })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onShowLicences}>
            {t("command.licences")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
