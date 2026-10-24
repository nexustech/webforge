import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useId, useState } from "react";
import { DEVICE_NAME_MAX, DEVICE_SIZE } from "../../shared/ipc/prefs.js";

/** A device as the person describes it: its name and size in CSS pixels. */
export type NewDevice = { readonly name: string; readonly width: number; readonly height: number };

/** The longest device name the preferences keep. */

/** `value` as a size the canvas can show, or undefined. */
function sizeOf(value: string): number | undefined {
  const size = Number(value);
  return value.trim() !== "" &&
    Number.isInteger(size) &&
    size >= DEVICE_SIZE.min &&
    size <= DEVICE_SIZE.max
    ? size
    : undefined;
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {/* The content mounts with each opening, so the form starts empty every time. */}
      <DialogContent>
        <DeviceForm onAdd={onAdd} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
}

function DeviceForm({
  onAdd,
  onCancel,
}: {
  readonly onAdd: (device: NewDevice) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const ids = { name: useId(), width: useId(), height: useId(), range: useId() };
  const device = {
    name: name.trim(),
    width: sizeOf(width),
    height: sizeOf(height),
  };
  const valid = device.name !== "" && device.width !== undefined && device.height !== undefined;
  const range = t("canvasToolbar.addDevice.range", DEVICE_SIZE);
  const size = (id: string, label: string, value: string, set: (next: string) => void) => (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={DEVICE_SIZE.min}
        max={DEVICE_SIZE.max}
        value={value}
        aria-describedby={ids.range}
        aria-invalid={value !== "" && sizeOf(value) === undefined}
        onChange={(event) => set(event.currentTarget.value)}
        className={fieldControlClass}
      />
    </div>
  );
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && device.width !== undefined && device.height !== undefined) {
          onAdd({ name: device.name, width: device.width, height: device.height });
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("canvasToolbar.addDevice.title")}</DialogTitle>
        <DialogDescription>{t("canvasToolbar.addDevice.description")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1">
        <label htmlFor={ids.name} className="text-xs text-muted-foreground">
          {t("canvasToolbar.addDevice.name")}
        </label>
        <input
          id={ids.name}
          value={name}
          maxLength={DEVICE_NAME_MAX}
          // biome-ignore lint/a11y/noAutofocus: the dialog exists to describe this device.
          autoFocus
          onChange={(event) => setName(event.currentTarget.value)}
          className={fieldControlClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {size(ids.width, t("canvasToolbar.addDevice.width"), width, setWidth)}
        {size(ids.height, t("canvasToolbar.addDevice.height"), height, setHeight)}
      </div>
      <p id={ids.range} className="m-0 text-xs text-muted-foreground">
        {range}
      </p>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("canvasToolbar.addDevice.cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("canvasToolbar.addDevice.confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}
