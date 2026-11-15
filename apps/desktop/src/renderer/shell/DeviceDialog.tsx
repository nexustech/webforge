import { FormDialog, type FormSpec } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { z } from "zod";
import { DEVICE_NAME_MAX, DEVICE_SIZE, newDeviceSchema } from "../../shared/ipc/prefs.js";
import "./form-messages.js";

/** A device as the person describes it: its name and size in CSS pixels. */
export type NewDevice = z.infer<typeof newDeviceSchema>;

type DeviceValues = { readonly name: string; readonly width: string; readonly height: string };

/** A size as typed, as the schema checks it: nothing while it's empty. */
const sizeOf = (typed: string) => (typed.trim() === "" ? undefined : Number(typed));

/** The form: a name, a width and a height, checked as the person types against the prefs' schema. */
const SPEC: FormSpec<DeviceValues, NewDevice> = {
  fields: () => {
    const range = t("canvasToolbar.addDevice.range", DEVICE_SIZE);
    const size = { kind: "number", ...DEVICE_SIZE, width: "sm", help: range } as const;
    return [
      {
        kind: "text",
        name: "name",
        label: t("canvasToolbar.addDevice.name"),
        maxLength: DEVICE_NAME_MAX,
      },
      { ...size, name: "width", label: t("canvasToolbar.addDevice.width") },
      { ...size, name: "height", label: t("canvasToolbar.addDevice.height") },
    ];
  },
  schema: newDeviceSchema,
  toModel: ({ name, width, height }) => ({ name, width: sizeOf(width), height: sizeOf(height) }),
  validateOn: "change",
};

type WidthValues = { readonly width: string };

/** A width alone, as a device's is checked. */
const widthSchema = newDeviceSchema.pick({ width: true });

/** The form of *Canvas width…*: the width only. */
const WIDTH_SPEC: FormSpec<WidthValues, z.infer<typeof widthSchema>> = {
  fields: () => [
    {
      kind: "number",
      ...DEVICE_SIZE,
      width: "sm",
      help: t("canvasToolbar.addDevice.range", DEVICE_SIZE),
      name: "width",
      label: t("canvasToolbar.addDevice.width"),
    },
  ],
  schema: widthSchema,
  toModel: ({ width }) => ({ width: sizeOf(width) }),
  validateOn: "change",
};

/**
 * *Canvas width…* (#1008): the toolbar's width box, from its View menu once the toolbar is too
 * narrow to show the box. Shows the page at that width; never an undo step (U6).
 */
export function WidthDialog({
  open,
  width,
  onShow,
  onCancel,
}: {
  readonly open: boolean;
  /** The canvas's width now, to start from. */
  readonly width: number;
  readonly onShow: (width: number) => void;
  readonly onCancel: () => void;
}) {
  return (
    <FormDialog
      open={open}
      title={t("canvasToolbar.widthDialog.title")}
      description={t("canvasToolbar.widthDialog.description")}
      confirm={t("canvasToolbar.widthDialog.confirm")}
      spec={WIDTH_SPEC}
      initial={{ width: String(width) }}
      onSave={(value) => onShow(value.width)}
      onCancel={onCancel}
    />
  );
}

/**
 * *Add device…* (F-ED-25, UX-8): a name, a width and a height, for the canvas's device list. The
 * device is the person's own, on every site; adding one is never an undo step.
 */
export function DeviceDialog({
  open,
  onAdd,
  onCancel,
}: {
  readonly open: boolean;
  readonly onAdd: (device: NewDevice) => void;
  readonly onCancel: () => void;
}) {
  return (
    <FormDialog
      open={open}
      title={t("canvasToolbar.addDevice.title")}
      description={t("canvasToolbar.addDevice.description")}
      confirm={t("canvasToolbar.addDevice.confirm")}
      spec={SPEC}
      initial={{ name: "", width: "", height: "" }}
      onSave={(device) => onAdd(device)}
      onCancel={onCancel}
    />
  );
}
