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
};

const interfaceSchema = z.strictObject({
  theme: z.enum(["dark", "light"]),
  editorLevel: z.enum(["simple", "advanced"]),
});

/** Interface (LF-12): the editor's theme and its level, which the View menu switches too. */
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
 * The app's parts of Settings (LF-12): Interface and Devices. They save the person's preferences,
 * never an undo step. Backups and Updates join when they have settings of their own.
 */
export function registerAppSettings(
  registry: SettingsRegistry,
  preferences: PreferencesStore,
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
          initial: { theme: now().theme, editorLevel: now().editorLevel },
          save: (change) => {
            const { theme, editorLevel } = now();
            if (change.theme !== theme || change.editorLevel !== editorLevel) {
              preferences.change(change);
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
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
