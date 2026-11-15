import { t } from "@webforge/i18n";
import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../../lib/cn.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu.js";
import type {
  DeviceValue,
  EditPanelField,
  EditPanelProps,
  FieldSource,
} from "./edit-panel-types.js";
import { drawField, useFieldRenderers } from "./field-context.js";

/**
 * A field's per-device dot (UX-19): grey while the device shown uses Desktop's value, the accent
 * colour once it has its own. A dot in the accent colour clears it (`onClear`): the device uses
 * Desktop's value again.
 */
function DeviceDot({
  label,
  device,
  overridden,
  onClear,
}: {
  readonly label: string;
  readonly device: string;
  readonly overridden: boolean;
  readonly onClear: (() => void) | undefined;
}) {
  const dot = (
    <span
      aria-hidden
      className={cn("block size-2 rounded-full", overridden ? "bg-ring" : "bg-muted-foreground/40")}
    />
  );
  if (!overridden || onClear === undefined) {
    const title = overridden
      ? t("editPanel.dot.set", { device, field: label })
      : t("editPanel.dot.inherits", { device, field: label });
    return (
      <span
        role="img"
        aria-label={title}
        title={title}
        className="p-1"
        data-device-dot={overridden ? "set" : "inherits"}
      >
        {dot}
      </span>
    );
  }
  const title = t("editPanel.dot.clear", { device, field: label });
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      className="rounded-full p-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
      data-device-dot="set"
      onClick={onClear}
    >
      {dot}
    </button>
  );
}

/**
 * `label` with the part the search found in it marked (SP-6), in the case the label has it; the
 * label as it is when the search is empty or isn't in it.
 */
function withMatch(label: string, query: string): ReactNode {
  const at = query === "" ? -1 : label.toLocaleLowerCase().indexOf(query);
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      <mark className="rounded-xs bg-ring/25 text-foreground">
        {label.slice(at, at + query.length)}
      </mark>
      {label.slice(at + query.length)}
    </>
  );
}

/** A field the person can reset to its default: changed, and not disabled (R11). */
export const resettable = (field: EditPanelField) =>
  field.changed === true && field.disabled !== true;

/**
 * Kinds whose control needs the panel's width (LF-7): their label sits above them, not beside.
 * Lists, spacing boxes, images and a paragraph of text.
 */
const isWide = (field: EditPanelField) =>
  // A colour's names, a link's buttons and a long text need the panel's width (#1007).
  field.kind === "color" ||
  field.kind === "link" ||
  (field.kind === "text" && field.wide === true) ||
  field.kind === "list" ||
  field.kind === "box" ||
  field.kind === "image" ||
  field.kind === "imageChoice" ||
  field.kind === "multiChoice" ||
  (field.kind === "text" && field.multiline === true);

/**
 * One field (LF-7): its muted label on the left, about two fifths of the row, with its per-device
 * dot, and its control filling the right, in 24 px rows; a wide control under its label instead.
 * The label's menu resets it.
 */
export function FieldRow({
  idPrefix,
  field,
  onChange,
  onChangeOn,
  onCommit,
  device,
  onReset,
  onResetToDefault,
  query,
}: {
  readonly idPrefix: string;
  readonly field: EditPanelField;
  readonly onChangeOn: EditPanelProps["onChangeOn"] | undefined;
  /** The search's text, lower case: the part of the label it found is marked (SP-6). */
  readonly query: string;
  readonly onChange: EditPanelProps["onChange"];
  readonly onCommit: EditPanelProps["onCommit"];
  readonly device: string | undefined;
  readonly onReset: EditPanelProps["onReset"] | undefined;
  readonly onResetToDefault: EditPanelProps["onResetToDefault"] | undefined;
}) {
  const renderers = useFieldRenderers();
  const id = `${idPrefix}-${field.name}`;
  const labelId = `${id}-label`;
  // The help and the warning, read together as the control's description.
  const helpId =
    field.help === undefined && field.warning === undefined && field.source === undefined
      ? undefined
      : `${id}-help`;
  const errorId = field.error === undefined ? undefined : `${id}-error`;
  const resetField =
    resettable(field) && onResetToDefault !== undefined
      ? () => onResetToDefault([field.name])
      : undefined;
  const wide = isWide(field);
  // Its rows per device, open or not (SP-5).
  const [perDevice, setPerDevice] = useState(false);
  const devices =
    field.devices !== undefined && field.devices.length > 1 && onChangeOn !== undefined
      ? field.devices
      : undefined;
  const devicesId = `${id}-devices`;
  return (
    <div
      className={cn(
        wide
          ? "flex flex-col gap-1"
          : "grid min-h-6 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-x-2 gap-y-1",
      )}
      data-field={field.name}
    >
      {/* The menu is the label's: a right-click in a text field keeps its own (spelling, F-ED-19). */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex min-w-0 items-center gap-1">
            <label
              id={labelId}
              htmlFor={id}
              title={field.label}
              className="truncate text-xs text-muted-foreground"
            >
              {withMatch(field.label, query)}
            </label>
            {field.responsive === true || field.overridden === true ? (
              <DeviceDot
                label={field.label}
                device={device ?? ""}
                overridden={field.overridden === true}
                onClear={
                  onReset === undefined || field.disabled === true
                    ? undefined
                    : () => onReset(field.name)
                }
              />
            ) : null}
            {devices === undefined ? null : (
              <button
                type="button"
                aria-expanded={perDevice}
                aria-controls={perDevice ? devicesId : undefined}
                aria-label={t("editPanel.devices.show", { field: field.label })}
                title={t("editPanel.devices.show", { field: field.label })}
                className="ml-auto shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setPerDevice(!perDevice)}
              >
                <ChevronRightIcon
                  aria-hidden
                  className={cn("size-3 transition-transform", perDevice && "rotate-90")}
                />
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={resetField === undefined} onSelect={resetField}>
            {field.resetLabel ?? t("editPanel.resetField")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div className="min-w-0">
        {drawField(renderers, field.kind, {
          id,
          labelId,
          ...(helpId === undefined ? {} : { helpId }),
          ...(errorId === undefined ? {} : { errorId }),
          ...(field.disabled === true ? { disabled: true } : {}),
          name: field.name,
          field,
          value: field.value,
          onChange: (value) => onChange(field.name, value),
          onCommit: () => onCommit(field.name),
        })}
      </div>
      {/* Under the control, in its column. */}
      {errorId === undefined ? null : (
        <p id={errorId} className={cn("text-2xs text-destructive-text", !wide && "col-start-2")}>
          {field.error}
        </p>
      )}
      {helpId === undefined ? null : (
        <div id={helpId} className={cn("flex flex-col gap-1", !wide && "col-start-2")}>
          {field.warning === undefined ? null : (
            <p className="flex items-start gap-1 text-xs text-foreground">
              <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
              {field.warning}
            </p>
          )}
          {field.help === undefined ? null : (
            <p className="text-2xs text-muted-foreground">{field.help}</p>
          )}
          {field.source === undefined ? null : <SourceLine source={field.source} />}
        </div>
      )}
      {devices === undefined || !perDevice ? null : (
        <fieldset
          id={devicesId}
          aria-label={t("editPanel.devices.show", { field: field.label })}
          className={cn(
            "m-0 flex min-w-0 flex-col gap-1 border-0 border-l-2 border-border p-0 pl-2",
            !wide && "col-span-2",
          )}
        >
          {devices.map((each) => (
            <DeviceRow
              key={each.id}
              id={`${id}-${each.id}`}
              field={field}
              device={each}
              onChange={(value) => onChangeOn?.(field.name, each.id, value)}
              onCommit={() => onCommit(field.name)}
            />
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** Where a field's value comes from (CT-3): plain words, or a link that shows it. */
function SourceLine({ source }: { readonly source: FieldSource }) {
  const { text, onReveal } = source;
  return (
    <p data-source className="text-2xs text-muted-foreground">
      {onReveal === undefined ? (
        text
      ) : (
        <button
          type="button"
          title={t("editPanel.source.reveal")}
          className="cursor-pointer text-left text-ring underline-offset-2 hover:underline focus-visible:underline"
          onClick={onReveal}
        >
          {text}
        </button>
      )}
    </p>
  );
}

/**
 * One device's row of a field (SP-5): the device's name, in the accent where it has a value of its
 * own, the dot on the device whose value the device shown takes, and the control for its value.
 */
function DeviceRow({
  id,
  field,
  device,
  onChange,
  onCommit,
}: {
  readonly id: string;
  readonly field: EditPanelField;
  readonly device: DeviceValue;
  readonly onChange: (value: unknown) => void;
  readonly onCommit: () => void;
}) {
  const renderers = useFieldRenderers();
  const labelId = `${id}-label`;
  return (
    <div
      className="grid min-h-6 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-x-2"
      data-device={device.id}
    >
      <div className="flex min-w-0 items-center gap-1">
        <label
          id={labelId}
          htmlFor={id}
          title={device.label}
          className={cn(
            "truncate text-xs",
            device.own ? "font-semibold text-ring" : "text-muted-foreground",
          )}
        >
          {device.label}
          {device.own ? <span className="sr-only">{`, ${t("editPanel.devices.own")}`}</span> : null}
        </label>
        {device.inEffect ? (
          <span
            role="img"
            aria-label={t("editPanel.devices.inEffect")}
            title={t("editPanel.devices.inEffect")}
            className="p-1"
          >
            <span aria-hidden className="block size-2 rounded-full bg-ring" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        {drawField(renderers, field.kind, {
          id,
          labelId,
          ...(field.disabled === true ? { disabled: true } : {}),
          name: field.name,
          field,
          value: device.value,
          onChange,
          onCommit,
        })}
      </div>
    </div>
  );
}
