import type { FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { z } from "zod";
import { VERSIONS_KEPT_MAX, VERSIONS_KEPT_MIN } from "../../shared/ipc/prefs.js";
import { type SettingsRegistry, settingsPart } from "../editor/settings-registry.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import "../shell/form-messages.js";

type KeptValues = { readonly versionsKept: string };

const keptSchema = z.strictObject({
  versionsKept: z.int().min(VERSIONS_KEPT_MIN).max(VERSIONS_KEPT_MAX),
});

/** A count as typed, as the schema checks it: not a number while it's empty. */
const countOf = (typed: string) => (typed.trim() === "" ? Number.NaN : Number(typed.trim()));

/** Version History (P3): how many of the versions {appName} saves itself each site keeps. */
const VERSIONS: FormSpec<KeptValues, z.infer<typeof keptSchema>> = {
  fields: () => [
    {
      kind: "text",
      name: "versionsKept",
      label: t("settings.versions.kept"),
      help: t("settings.versions.keptHelp", { min: VERSIONS_KEPT_MIN, max: VERSIONS_KEPT_MAX }),
      width: "sm",
    },
  ],
  schema: keptSchema,
  toModel: ({ versionsKept }) => ({ versionsKept: countOf(versionsKept) }),
};

/**
 * The app's Version History part of Settings (LF-12, P3): Versions kept, a preference of the
 * person's for every site, never an undo step. After the app's Interface and Devices.
 */
export function registerVersionSettings(
  registry: SettingsRegistry,
  preferences: PreferencesStore,
): () => void {
  const now = () => preferences.getState().preferences.versionsKept;
  return registry.register({
    id: "versions",
    heading: "app",
    order: 2,
    open: () =>
      settingsPart({
        id: "versions",
        heading: "app",
        label: t("settings.versions"),
        spec: VERSIONS,
        initial: { versionsKept: String(now()) },
        save: ({ versionsKept }) => {
          if (versionsKept !== now()) preferences.change({ versionsKept });
        },
      }),
  });
}
