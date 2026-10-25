import type { FieldSpec } from "../edit/field-spec.js";

/** A form's values by field name, as the person edits them: text as typed, lists with ids. */
export type FormValues = Readonly<Record<string, unknown>>;

/** One field of a form (2.21): what it is, as an Edit panel field is, and where its value lives. */
export type FormField = FieldSpec & {
  /** Its value's key in the form's values. */
  readonly name: string;
  /**
   * Where the schema checks it, dotted, with `*` for a list's position (`social.profiles.*.url`);
   * its name when left out. The schema's issues at this path are the field's.
   */
  readonly path?: string;
  /** The group (tab) it shows in, one of the form's `groups`; none when the form has none. */
  readonly group?: string;
  /** How wide its control is: a few characters, half the form, or the form's width (the default). */
  readonly width?: "sm" | "md" | "full";
  readonly disabled?: boolean;
  /** A list's new item's values, when the person adds one (an id is added). */
  readonly newItem?: () => FormValues;
};

/** Why a value isn't acceptable: the schema path it is about, and a translated message. */
export type FormIssue = { readonly path: readonly PropertyKey[]; readonly message: string };

/** What a schema's check gives: the checked value, or what is wrong with it. */
export type FormSchemaResult<Out> =
  | { readonly value: Out; readonly issues?: undefined }
  | {
      readonly issues: readonly {
        readonly message: string;
        readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
      }[];
    };

/**
 * The schema a form's values are checked against, as a Standard Schema (standardschema.dev): the
 * model's zod schemas are, so limits and messages come from one place (B3), and editor-ui needs
 * neither zod nor the model. Checks must be synchronous.
 */
export type FormSchema<Out> = {
  readonly "~standard": {
    readonly validate: (value: unknown) => FormSchemaResult<Out> | Promise<FormSchemaResult<Out>>;
  };
};

/**
 * A form (2.21, B3): its fields, drawn by the field renderers as the Edit panel's are, and the
 * schema its values must pass. Dialogs declare one instead of drawing their own fields.
 */
export type FormSpec<V extends FormValues, Out> = {
  /** Its tabs, in order; none for a form on one page. */
  readonly groups?: readonly { readonly id: string; readonly label: string }[];
  /** Its fields, in order: fixed, or as the values ask (a form service's one value). */
  readonly fields: readonly FormField[] | ((values: V) => readonly FormField[]);
  readonly schema: FormSchema<Out>;
  /** The values as the schema takes them: trimmed, in the model's shape. */
  readonly toModel: (values: V) => unknown;
  /** Problems the schema can't see (a name that's taken), with the field's path. */
  readonly check?: (values: V) => readonly FormIssue[];
  /** The values after a change, made consistent (a new form service clears the old one's value). */
  readonly adjust?: (next: V, previous: V) => V;
  /**
   * When problems show: as the person types, or once they try to save (the default), and then as
   * they fix them.
   */
  readonly validateOn?: "change" | "save";
};
