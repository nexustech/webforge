import { type ReactNode, useId, useState } from "react";
import { cn } from "../../lib/cn.js";
import { BoxField } from "../edit/box-field.js";
import { ChoiceField } from "../edit/choice-field.js";
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

/** The Edit panel's renderers a form starts from; the app's own (link, image, colour) go over them. */
const PANEL_RENDERERS: FieldRenderers = {
  ...PLAIN_RENDERERS,
  // The Edit panel's lists, in Site Settings too (PH2-13).
  list: ListField,
  box: BoxField,
};

/**
 * What a form draws its own way, over any renderers around it: a checkbox for an on/off field, as
 * dialogs have, and the form-only kinds. A dialog opened from the Edit panel (the link dialog) is
 * inside the panel's renderers, whose on/off field is a switch (#391).
 */
const FORM_OWN: FieldRenderers = {
  toggle: CheckField,
  number: NumberField,
  time: TimeField,
  multiChoice: MultiChoiceField,
  imageChoice: ImageChoiceField,
  choice: ChoiceField,
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
  const renderers: FieldRenderers = { ...PANEL_RENDERERS, ...useFieldRenderers(), ...FORM_OWN };
  const navId = useId();
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
  const marker = (group: string) =>
    hasIssue(group) ? (
      <span aria-hidden className="ml-1 size-1.5 rounded-full bg-destructive" />
    ) : null;
  // Groups with headings are listed down the side, under them (LF-12): a tab list per heading.
  const headings = [...new Set(groups.flatMap((group) => group.heading ?? []))];
  if (headings.length > 0) {
    return (
      <div className="grid gap-3">
        {general}
        <Tabs
          orientation="vertical"
          // A section is chosen with a click or Enter, not by focus: each heading's list has a tab to
          // focus, and the dialog's first focus would otherwise choose App's first section.
          activationMode="manual"
          value={tab}
          onValueChange={setTab}
          className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-4"
        >
          <nav
            {...(groupsLabel === undefined ? {} : { "aria-label": groupsLabel })}
            className="flex flex-col gap-3"
          >
            {headings.map((heading, index) => (
              <div key={heading} className="flex flex-col gap-0.5">
                <p
                  id={`${navId}-${index}`}
                  className="m-0 px-2 text-xs font-semibold text-muted-foreground"
                >
                  {heading}
                </p>
                <TabsList
                  aria-labelledby={`${navId}-${index}`}
                  className="h-auto flex-col items-stretch bg-transparent p-0"
                >
                  {groups
                    .filter((group) => group.heading === heading)
                    .map((group) => (
                      <TabsTrigger
                        key={group.id}
                        value={group.id}
                        className="h-7 justify-start px-2 font-normal data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                      >
                        {group.label}
                        {marker(group.id)}
                      </TabsTrigger>
                    ))}
                </TabsList>
              </div>
            ))}
          </nav>
          <div className="min-w-0">
            {groups.map((group) => (
              <TabsContent key={group.id} value={group.id} className="bg-transparent">
                {draw(fields.filter((field) => field.group === group.id))}
              </TabsContent>
            ))}
          </div>
        </Tabs>
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
              {marker(group.id)}
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
