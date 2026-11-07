import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect } from "react";
import type { HelpApi, HelpTarget } from "../../shared/ipc/help.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { bundledHelpLibrary, type HelpLibrary } from "./help-library.js";

/** Opens the Help window at `target` through `help`, saying so if it didn't open. */
export function openHelpWith(help: Pick<HelpApi, "open">, target: HelpTarget): void {
  help
    .open(target)
    .then((opened) => {
      if (!opened) toast.error(t("help.openFailed"));
    })
    .catch((error: unknown) => {
      reportFailure("help.open", error);
      toast.error(t("help.openFailed"));
    });
}

export type HelpCommandsProps = {
  /** `window.webforge.help`. */
  readonly help: Pick<HelpApi, "open">;
  /** The help pages; the bundled ones by default. */
  readonly library?: HelpLibrary;
};

/**
 * Help's commands (5.4b, HP-6): **Help › {appName} Help** (F1), which opens the Help window at its
 * contents, and each help page as a topic in Search Commands' *Help* group, found by its title and
 * summary. Drawn before the shell's own Help items, so it heads the Help menu.
 */
export function HelpCommands({ help, library }: HelpCommandsProps) {
  const registry = useCommandRegistry();
  useEffect(() => {
    const open = (target: HelpTarget) => openHelpWith(help, target);
    const removers = [
      registry.register({
        id: COMMAND_IDS.help,
        label: t("command.help"),
        menu: "help",
        run: () => open({}),
      }),
      ...(library ?? bundledHelpLibrary()).ordered.map((page) =>
        registry.register({
          id: `help.page.${page.id}`,
          label: page.title,
          palette: "help",
          paletteLabel: t("help.topic", { title: page.title }),
          keywords: [page.summary],
          run: () => open({ page: page.id }),
        }),
      ),
    ];
    return () => {
      for (const remove of removers) remove();
    };
  }, [registry, help, library]);
  return null;
}
