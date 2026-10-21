import { t } from "@webforge/i18n";
import { useId } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { type FieldRenderer, type FieldSpec, fieldRenderer } from "./field-registry.js";
import { SelectField } from "./select-field.js";
import { TextField } from "./text-field.js";

/** Which tab a field belongs on (Content for what it says, Style for how it looks). */
export type FieldGroup = "content" | "style";

/** One field of the selected element, with its current value. */
export type EditPanelField = FieldSpec & {
  readonly name: string;
  readonly group: FieldGroup;
  readonly value: unknown;
};

/** Props of {@link EditPanel}. */
export type EditPanelProps = {
  /** The selected element's name, such as "Heading"; undefined when nothing is selected. */
  readonly heading?: string | undefined;
  readonly fields: readonly EditPanelField[];
  onChange(name: string, value: unknown): void;
  /** The user is done with a field (it lost focus, or a choice was made). */
  onCommit(name: string): void;
};

/** The renderers every Edit panel has; `registerFieldRenderer` adds kinds or replaces these. */
const BUILT_IN: Readonly<Record<string, FieldRenderer>> = { text: TextField, select: SelectField };

const rendererFor = (kind: string) => fieldRenderer(kind) ?? BUILT_IN[kind];

function FieldList({
  idPrefix,
  fields,
  onChange,
  onCommit,
}: Omit<EditPanelProps, "heading"> & { readonly idPrefix: string }) {
  if (fields.length === 0) {
    return <p className="p-3 text-xs text-muted-foreground">{t("editPanel.noFields")}</p>;
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      {fields.map((field) => {
        const Renderer = rendererFor(field.kind) as FieldRenderer;
        const id = `${idPrefix}-${field.name}`;
        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs text-muted-foreground">
              {field.label}
            </label>
            <Renderer
              id={id}
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
export function EditPanel({ heading, fields, onChange, onCommit }: EditPanelProps) {
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
  return (
    <div className="flex h-full flex-col">
      <h2 className="truncate px-3 pt-2 text-sm font-semibold text-foreground">{heading}</h2>
      <Tabs
        // A new element starts on its first tab with fields.
        key={heading}
        defaultValue={content.length > 0 || style.length === 0 ? "content" : "style"}
        className="min-h-0 flex-1"
      >
        <TabsList aria-label={t("editPanel.tabs")}>
          <TabsTrigger value="content">{t("editPanel.content")}</TabsTrigger>
          <TabsTrigger value="style">{t("editPanel.style")}</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="overflow-auto">
          <FieldList
            idPrefix={`${idPrefix}content`}
            fields={content}
            onChange={onChange}
            onCommit={onCommit}
          />
        </TabsContent>
        <TabsContent value="style" className="overflow-auto">
          <FieldList
            idPrefix={`${idPrefix}style`}
            fields={style}
            onChange={onChange}
            onCommit={onCommit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
