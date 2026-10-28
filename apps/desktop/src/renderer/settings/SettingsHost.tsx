import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { OpenSettings, SettingsRegistry } from "../editor/settings-registry.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { SettingsDialog } from "./SettingsDialog.js";

/** Props of {@link SettingsHost}. */
export type SettingsHostProps = {
  readonly registry: SettingsRegistry;
};

/**
 * The dialog as it was opened: its parts then (R9), the section it opened on, and who to tell when
 * it closes, for a step that opened it ({@link SettingsRegistry.show}).
 */
type Shown = {
  readonly open: boolean;
  readonly parts: readonly OpenSettings[];
  readonly group?: string;
  readonly closed?: (saved: boolean) => void;
};

/**
 * File → Settings… and File → Site Settings… (LF-12, F-SET-1), also in the command box: both open
 * the one {@link SettingsDialog}, on App's first section or on This site's.
 */
export function SettingsHost({ registry }: SettingsHostProps) {
  const commands = useCommandRegistry();
  const [shown, setShown] = useState<Shown>({ open: false, parts: [] });

  useEffect(() => {
    const hasSite = () => registry.list().some((entry) => entry.heading === "site");
    /** Opens the dialog on the first section of `heading`'s first part. */
    const open = (heading: "app" | "site") => {
      const entries = registry.list();
      const parts = entries.flatMap((entry) => entry.open() ?? []);
      const first = entries.find((entry) => entry.heading === heading);
      const part = parts.find((each) => each.form.id === first?.id);
      // Site Settings… with no site's part to show: nothing to open (its command is off then).
      if (heading === "site" && part === undefined) return;
      const group = part?.form.spec.groups?.[0]?.id ?? "";
      setShown({
        open: true,
        parts,
        ...(part === undefined ? {} : { group: `${part.form.id}:${group}` }),
      });
    };
    const stops = [
      commands.register({
        id: COMMAND_IDS.settings,
        label: t("settings.command"),
        menu: "file",
        run: () => open("app"),
      }),
      commands.register({
        id: COMMAND_IDS.siteSettings,
        label: t("site.settings.command"),
        menu: "file",
        enabled: hasSite(),
        run: () => open("site"),
      }),
      // Site Settings… is on while a site's part is there, as other site-only commands are.
      registry.subscribe(() => commands.update(COMMAND_IDS.siteSettings, { enabled: hasSite() })),
      // A step that needs a setting opens the dialog on its section, and hears how it closed.
      registry.onShow(({ part, group, closed }) => {
        const parts = registry.list().flatMap((entry) => entry.open() ?? []);
        if (!parts.some((each) => each.form.id === part)) {
          closed(false);
          return;
        }
        setShown({ open: true, parts, group: `${part}:${group}`, closed });
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, [commands, registry]);

  const close = (saved: boolean) => {
    shown.closed?.(saved);
    setShown((current) => ({ open: false, parts: current.parts }));
  };

  return (
    <SettingsDialog
      open={shown.open}
      parts={shown.parts}
      initialGroup={shown.group}
      onSaved={() => close(true)}
      onCancel={() => close(false)}
    />
  );
}
