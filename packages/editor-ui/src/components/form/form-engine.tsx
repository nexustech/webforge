import { type ReactNode, useState } from "react";
import { cn } from "../../lib/cn.js";
import { BoxField } from "../edit/box-field.js";
import { drawField, useFieldRenderers } from "../edit/field-context.js";
import type { FieldKind, FieldRendererProps, FieldRenderers } from "../edit/field-spec.js";
import { ListField } from "../edit/list-field.js";
import { PLAIN_RENDERERS } from "../edit/plain-renderers.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { ErrorText, Field } from "./form.js";
import {
  CheckField,
  ImageChoiceField,
  MultiChoiceField,
  NumberField,
  TimeField,
} from "./form-fields.js";
import type { FormField, FormValues } from "./form-spec.js";
import {
  concerns,
  type FormState,
  issueOf,
  itemIssuesOf,
  itemsOf,
  unplacedIssues,
} from "./use-form.js";

/**
 * The renderers a form draws its fields with: the Edit panel's, the form-only kinds', and a
 * checkbox for an on/off field, as dialogs have. The app's own (link, image, colour) come from
 * {@link FieldRenderersProvider}, over these.
 */
const FORM_RENDERERS: FieldRenderers = {
  ...PLAIN_RENDERERS,
  // The Edit panel's lists, in Site Settings too (PH2-13).
  list: ListField,
  box: BoxField,
  toggle: CheckField,
  number: NumberField,
  time: TimeField,
  multiChoice: MultiChoiceField,
  imageChoice: ImageChoiceField,
};

/** Classes of a control `width` wide. */
const WIDTH = { sm: "w-32", md: "w-64 max-w-full", full: "" } as const;

/** Props of {@link Form}. */
export type FormProps<V extends FormValues, Out> = {
  /** The form, from {@link useForm}. */
  readonly form: FormState<V, Out>;
  /** What its tabs are, for screen readers ("Site Settings sections"); with groups only. */
  readonly groupsLabel?: string;
  /** The tab it opens on; its first when left out. */
  readonly initialGroup?: string;
};

/**
 * A form's fields (2.21, B3), drawn by the field renderers as the Edit panel draws its own, each
 * with its label, help and problem (R10's `Field`); on tabs if the form has groups. Problems no
 * field shows are listed above the fields. After a failed Save it shows the first tab with one.
 */
export function Form<V extends FormValues, Out>({
  form,
  groupsLabel,
  initialGroup,
}: FormProps<V, Out>) {
  const renderers: FieldRenderers = { ...FORM_RENDERERS, ...useFieldRenderers() };
  const { fields, issues } = form;
  const groups = form.spec.groups ?? [];
  const [tab, setTab] = useState(initialGroup ?? groups[0]?.id ?? "");
  const [seen, setSeen] = useState(form.attempts);
  const hasIssue = (group: string) =>
    fields.some((field) => field.group === group && issues.some((issue) => concerns(field, issue)));
  if (seen !== form.attempts) {
    setSeen(form.attempts);
    const first = groups.find((group) => hasIssue(group.id));
    if (first !== undefined && !hasIssue(tab)) setTab(first.id);
  }

  const draw = (shown: readonly FormField[]) => (
    <div className="grid gap-3">
      {shown.map((field) => (
        <FormFieldRow
          key={field.name}
          field={field}
          value={form.values[field.name]}
          error={issueOf(field, issues)}
          {...(field.kind === "list"
            ? { itemErrors: itemIssuesOf(field, itemsOf(form.values[field.name]), issues) }
            : {})}
          renderers={renderers}
          onChange={(value) => form.change(field.name, value)}
        />
      ))}
    </div>
  );
  const unplaced = unplacedIssues(fields, issues);
  const general =
    unplaced.length === 0 ? null : (
      <div role="alert" className="grid gap-0.5">
        {unplaced.map((issue) => (
          <ErrorText key={`${issue.path.join(".")} ${issue.message}`} message={issue.message} />
        ))}
      </div>
    );
  if (groups.length === 0) {
    return (
      <div className="grid gap-3">
        {general}
        {draw(fields)}
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {general}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          {...(groupsLabel === undefined ? {} : { "aria-label": groupsLabel })}
          // Many groups wrap onto a second row in a narrow window; each row keeps the tabs' height.
          className="h-auto flex-wrap [&>*]:h-8"
        >
          {groups.map((group) => (
            <TabsTrigger key={group.id} value={group.id}>
              {group.label}
              {hasIssue(group.id) ? (
                <span aria-hidden className="ml-1 size-1.5 rounded-full bg-destructive" />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map((group) => (
          <TabsContent key={group.id} value={group.id} className="pt-3">
            {draw(fields.filter((field) => field.group === group.id))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/**
 * Kinds whose control needs the form's width (LF-7): their label sits above them, as in the Edit
 * panel. Lists, choices of several, images and a paragraph of text.
 */
const isWide = (field: FormField) =>
  field.kind === "list" ||
  field.kind === "box" ||
  field.kind === "multiChoice" ||
  field.kind === "imageChoice" ||
  (field.kind === "text" && field.multiline === true);

/**
 * One field of a form, in a two-column row (LF-7) unless it is wide: its label, its control (by its
 * kind's renderer), its problem and help.
 */
function FormFieldRow({
  field,
  value,
  error,
  itemErrors,
  renderers,
  onChange,
}: {
  readonly field: FormField;
  readonly value: unknown;
  readonly error: string | undefined;
  readonly itemErrors?: FieldRendererProps["itemErrors"];
  readonly renderers: FieldRenderers;
  readonly onChange: (value: unknown) => void;
}) {
  const control = (props: Omit<FieldRendererProps, "field" | "value" | "onChange" | "onCommit">) =>
    drawField(
      renderers,
      field.kind as FieldKind,
      {
        ...props,
        ...(field.disabled === true ? { disabled: true } : {}),
        ...(itemErrors === undefined ? {} : { itemErrors }),
        field,
        value,
        onChange,
        // A form keeps its values until Save: a run of changes needs no end.
        onCommit: () => undefined,
      } as FieldRendererProps,
    );
  const wide = (node: ReactNode) => <div className={cn(WIDTH[field.width ?? "full"])}>{node}</div>;
  return (
    <Field
      // An on/off field's label is beside its checkbox, which draws it.
      label={field.kind === "toggle" ? undefined : field.label}
      hint={field.help}
      error={error}
      layout={isWide(field) ? "stacked" : "row"}
    >
      {(ids, { labelId, hintId, errorId }) =>
        wide(
          control({
            id: ids.id,
            labelId,
            ...(hintId === undefined ? {} : { helpId: hintId }),
            ...(errorId === undefined ? {} : { errorId }),
          }),
        )
      }
    </Field>
  );
}
