import { t } from "@webforge/i18n";
import { useId } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { type FieldRenderer, type FieldSpec, fieldRenderer } from "./field-registry.js";
import { ListField } from "./list-field.js";
import { PLAIN_RENDERERS } from "./plain-renderers.js";

/**
 * Which tab a field belongs on: Content for what it says, Style for how it looks, Advanced for
 * classes, attributes and the anchor (Advanced mode only, F-ED-11).
 */
export type FieldGroup = "content" | "style" | "advanced";

/** One field of the selected element, with its current value. */
export type EditPanelField = FieldSpec & {
  readonly name: string;
  readonly group: FieldGroup;
  /** The value for the device being viewed. */
  readonly value: unknown;
  /** The value is set for this device only, overriding Desktop's (F-ED-4). */
  readonly overridden?: boolean;
};

/** Props of {@link EditPanel}. */
export type EditPanelProps = {
  /** The selected element's name, such as "Heading"; undefined when nothing is selected. */
  readonly heading?: string | undefined;
  readonly fields: readonly EditPanelField[];
  onChange(name: string, value: unknown): void;
  /** The user is done with a field (it lost focus, or a choice was made). */
  onCommit(name: string): void;
  /** The device being viewed, translated ("Mobile"), named in the override marker. */
  readonly device?: string | undefined;
  /** Drops a field's override, so the device uses the Desktop value again. */
  onReset?(name: string): void;
  /** Shows the Advanced tab and its fields (Advanced mode, F-ED-11). */
  readonly advanced?: boolean | undefined;
};

/** The renderers every Edit panel has; `registerFieldRenderer` adds kinds or replaces these. */
const BUILT_IN: Readonly<Record<string, FieldRenderer>> = { ...PLAIN_RENDERERS, list: ListField };

const rendererFor = (kind: string) => fieldRenderer(kind) ?? BUILT_IN[kind];

function FieldList({
  idPrefix,
  fields,
  onChange,
  onCommit,
  device,
  onReset,
}: Omit<EditPanelProps, "heading"> & { readonly idPrefix: string }) {
  if (fields.length === 0) {
    return <p className="p-3 text-xs text-muted-foreground">{t("editPanel.noFields")}</p>;
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      {fields.map((field) => {
        const Renderer = rendererFor(field.kind) as FieldRenderer;
        const id = `${idPrefix}-${field.name}`;
        const labelId = `${id}-label`;
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <label id={labelId} htmlFor={id} className="text-xs text-muted-foreground">
                {field.label}
              </label>
              {field.overridden === true ? (
                <>
                  <span
                    className="inline-flex items-center gap-1 rounded-sm bg-accent px-1 text-2xs text-accent-foreground"
                    data-override
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-ring" />
                    {t("editPanel.override", { device: device ?? "" })}
                  </span>
                  {onReset === undefined ? null : (
                    <button
                      type="button"
                      className="ml-auto text-2xs text-info underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => onReset(field.name)}
                    >
                      {t("editPanel.useDesktop")}
                    </button>
                  )}
                </>
              ) : null}
            </div>
            <Renderer
              id={id}
              labelId={labelId}
              field={field}
              value={field.value}
              onChange={(value) => onChange(field.name, value)}
              onCommit={() => onCommit(field.name)}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Edit panel (1.14): the selected element's fields on a Content and a Style tab, each drawn
 * by its kind's renderer. It only shows and reports; the app records each change in the history.
 */
export function EditPanel({
  heading,
  fields,
  onChange,
  onCommit,
  device,
  onReset,
  advanced = false,
}: EditPanelProps) {
  const idPrefix = useId();
  if (heading === undefined) {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {t("editPanel.empty")}
      </p>
    );
  }
  const shown = fields.filter((field) => rendererFor(field.kind) !== undefined);
  const content = shown.filter((field) => field.group === "content");
  const style = shown.filter((field) => field.group === "style");
  const advancedFields = shown.filter((field) => field.group === "advanced");
  const list = (group: FieldGroup, groupFields: readonly EditPanelField[]) => (
    <TabsContent value={group} className="overflow-auto">
      <FieldList
        idPrefix={`${idPrefix}${group}`}
        fields={groupFields}
        onChange={onChange}
        onCommit={onCommit}
        device={device}
        {...(onReset === undefined ? {} : { onReset })}
      />
    </TabsContent>
  );
  return (
    <div className="flex h-full flex-col">
      <h2 className="truncate px-3 pt-2 text-sm font-semibold text-foreground">{heading}</h2>
      <Tabs
        // Keyed by the element's type: the tab stays while moving between elements of one type, and
        // another type starts on its first tab with fields.
        key={heading}
        defaultValue={
          content.length > 0
            ? "content"
            : style.length > 0
              ? "style"
              : advanced && advancedFields.length > 0
                ? "advanced"
                : "content"
        }
        className="min-h-0 flex-1"
      >
        <TabsList aria-label={t("editPanel.tabs")}>
          <TabsTrigger value="content">{t("editPanel.content")}</TabsTrigger>
          <TabsTrigger value="style">{t("editPanel.style")}</TabsTrigger>
          {advanced ? <TabsTrigger value="advanced">{t("editPanel.advanced")}</TabsTrigger> : null}
        </TabsList>
        {list("content", content)}
        {list("style", style)}
        {advanced ? list("advanced", advancedFields) : null}
      </Tabs>
    </div>
  );
}
