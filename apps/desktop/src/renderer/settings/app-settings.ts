import type { FormSpec, ListItem } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { z } from "zod";
import {
  type CustomDevice,
  DEVICE_NAME_MAX,
  DEVICE_SIZE,
  deviceSchema,
  MAX_DEVICES,
  type Preferences,
} from "../../shared/ipc/prefs.js";
import type { PreferencesStore } from "../shell/preferences-store.js";
import "../shell/form-messages.js";
import { type SettingsRegistry, settingsPart } from "../editor/settings-registry.js";

type InterfaceValues = {
  readonly theme: Preferences["theme"];
  readonly editorLevel: Preferences["editorLevel"];
  readonly showTips: boolean;
  readonly showAgain: boolean;
};

const interfaceSchema = z.strictObject({
  theme: z.enum(["dark", "light"]),
  editorLevel: z.enum(["simple", "advanced"]),
  showTips: z.boolean(),
  showAgain: z.boolean(),
});

/**
 * Interface (LF-12): the editor's theme and its level, which the View menu switches too; and the
 * first-time tips, with the tour and tips shown again from the start (OB-5).
 */
const INTERFACE: FormSpec<InterfaceValues, z.infer<typeof interfaceSchema>> = {
  fields: () => [
    {
      kind: "select",
      name: "theme",
      label: t("settings.interface.appearance"),
      options: [
        { label: t("settings.interface.dark"), value: "dark" },
        { label: t("settings.interface.light"), value: "light" },
      ],
      width: "md",
    },
    {
      kind: "select",
      name: "editorLevel",
      label: t("settings.interface.level"),
      help: t("settings.interface.levelHelp"),
      options: [
        { label: t("settings.interface.simple"), value: "simple" },
        { label: t("settings.interface.advanced"), value: "advanced" },
      ],
      width: "md",
    },
    {
      kind: "toggle",
      name: "showTips",
      label: t("settings.interface.showTips"),
      help: t("settings.interface.showTipsHelp"),
    },
    {
      kind: "toggle",
      name: "showAgain",
      label: t("settings.interface.showAgain"),
      help: t("settings.interface.showAgainHelp"),
    },
  ],
  schema: interfaceSchema,
  toModel: (values) => values,
};

/** A device as its row holds it: sizes as typed. */
type DeviceItem = ListItem & {
  readonly name: string;
  readonly width: string;
  readonly height: string;
};

type DeviceValues = { readonly devices: readonly DeviceItem[] };

const devicesSchema = z.strictObject({ devices: z.array(deviceSchema).max(MAX_DEVICES) });

/** A size as typed, as the schema checks it: nothing while it's empty. */
const sizeOf = (typed: string) => (typed.trim() === "" ? undefined : Number(typed));

/**
 * Devices (LF-12): the person's own devices for the canvas (F-ED-25), named and sized as in *Add
 * device…*, each keeping its id.
 */
const DEVICES: FormSpec<DeviceValues, z.infer<typeof devicesSchema>> = {
  fields: () => [
    {
      kind: "list",
      name: "devices",
      label: t("settings.devices.label"),
      help: t("canvasToolbar.addDevice.range", DEVICE_SIZE),
      itemLabel: t("settings.devices.item"),
      addLabel: t("settings.devices.add"),
      removeLabel: t("settings.devices.remove"),
      itemFields: [
        {
          kind: "text",
          name: "name",
          label: t("canvasToolbar.addDevice.name"),
          maxLength: DEVICE_NAME_MAX,
        },
        { kind: "text", name: "width", label: t("canvasToolbar.addDevice.width") },
        { kind: "text", name: "height", label: t("canvasToolbar.addDevice.height") },
      ],
      newItem: () => ({ name: "", width: "", height: "" }),
    },
  ],
  schema: devicesSchema,
  toModel: ({ devices }) => ({
    devices: devices.map(({ id, name, width, height }) => ({
      id,
      name,
      width: sizeOf(width),
      height: sizeOf(height),
    })),
  }),
};

/**
 * AI apps (F-AI-1, #752): a line that opens *AI apps…*. Its own dialog acts at once, so it isn't a
 * part of Settings, which saves on Save; Settings stays open under it.
 */
const aiAppsSpec = (
  openAiApps: () => void,
): FormSpec<Record<string, never>, Record<string, never>> => ({
  fields: () => [
    {
      kind: "action",
      name: "aiApps",
      label: t("settings.aiApps.label"),
      help: t("settings.aiApps.help"),
      button: t("settings.aiApps.open"),
      run: openAiApps,
    },
  ],
  schema: z.strictObject({}),
  toModel: () => ({}),
});

/** Whether two device lists are the same devices, in the same order (#432 review). */
const sameDevices = (a: readonly CustomDevice[], b: readonly CustomDevice[]) =>
  a.length === b.length &&
  a.every(
    (device, index) =>
      device.id === b[index]?.id &&
      device.name === b[index]?.name &&
      device.width === b[index]?.width &&
      device.height === b[index]?.height,
  );

/** A device as its row starts. */
const itemOf = (device: CustomDevice): DeviceItem => ({
  id: device.id,
  name: device.name,
  width: String(device.width),
  height: String(device.height),
});

/**
 * The app's parts of Settings (LF-12): Interface and Devices, which save the person's preferences,
 * never an undo step; and AI apps, a line that opens its own dialog with `openAiApps` (#752).
 * Backups and Updates join when they have settings of their own.
 */
export function registerAppSettings(
  registry: SettingsRegistry,
  preferences: PreferencesStore,
  openAiApps: () => void,
): () => void {
  const now = () => preferences.getState().preferences;
  const stops = [
    registry.register({
      id: "interface",
      heading: "app",
      order: 0,
      open: () =>
        settingsPart({
          id: "interface",
          heading: "app",
          label: t("settings.interface"),
          spec: INTERFACE,
          initial: {
            theme: now().theme,
            editorLevel: now().editorLevel,
            showTips: now().onboarding.showTips,
            showAgain: false,
          },
          save: ({ showTips, showAgain, ...change }) => {
            const { theme, editorLevel, onboarding } = now();
            if (change.theme !== theme || change.editorLevel !== editorLevel) {
              preferences.change(change);
            }
            // Shown again: the tour is offered when a site next opens, and each tip once more.
            const next = showAgain
              ? { tour: "offer" as const, tipsSeen: [], showTips }
              : { ...onboarding, showTips };
            if (showAgain || showTips !== onboarding.showTips) {
              preferences.change({ onboarding: next });
            }
          },
        }),
    }),
    registry.register({
      id: "devices",
      heading: "app",
      order: 1,
      open: () =>
        settingsPart({
          id: "devices",
          heading: "app",
          label: t("settings.devices"),
          spec: DEVICES,
          initial: { devices: now().canvas.devices.map(itemOf) },
          save: ({ devices }) => {
            const { canvas } = now();
            if (!sameDevices(devices, canvas.devices)) {
              preferences.change({ canvas: { ...canvas, devices } });
            }
          },
        }),
    }),
    registry.register({
      id: "aiApps",
      heading: "app",
      // After Version History (2): the last of App's parts.
      order: 3,
      open: () =>
        settingsPart({
          id: "aiApps",
          heading: "app",
          label: t("settings.aiApps"),
          spec: aiAppsSpec(openAiApps),
          initial: {},
          // Nothing to keep: what AI apps changes, it changes at once.
          save: () => undefined,
        }),
    }),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
