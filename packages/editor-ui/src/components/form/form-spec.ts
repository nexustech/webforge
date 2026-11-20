import type { ReactNode } from "react";
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
  /**
   * Under the form's **More Options**, folded until the person opens it, or a check finds a problem
   * in it: what most people can leave as it is (#1172).
   */
  readonly more?: boolean;
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
  /**
   * Its tabs, in order; none for a form on one page. Groups with a `heading` are listed down the
   * side instead, under their headings (LF-12's Settings: "App", "This site").
   */
  readonly groups?: readonly {
    readonly id: string;
    readonly label: string;
    readonly heading?: string;
  }[];
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
   * Whether **More Options** starts open, from the values the form starts from: when something
   * folded there needs a look at once (plain FTP's warning, #1172). Folded when left out.
   */
  readonly moreOpen?: (values: V) => boolean;
  /**
   * Beside **More Options** while it is folded: what its fields hold, in a few words ("SFTP · port
   * 2222 · /site"), so nothing set there goes unseen; already translated. By the tab's group, in a
   * form with tabs.
   */
  readonly moreSummary?: (values: V, group: string | undefined) => string | undefined;
  /**
   * When problems show: as the person types, or once they try to save (the default), and then as
   * they fix them.
   */
  readonly validateOn?: "change" | "save";
  /**
   * What the form shows after a field besides it, by the field's name, from the values as typed:
   * Page Settings' search result under its title and description (3.16), or a button that checks
   * the form first (`form.validate`: Test Connection, #1014). Drawn in the form only; a part of
   * Settings (`combineForms`) has none.
   */
  readonly after?: (values: V, form: FormActions) => Readonly<Partial<Record<string, ReactNode>>>;
};

/** What a form's own content (`after`) can ask of the form. */
export type FormActions = {
  /**
   * Checks the values as Save does, and shows the problems `counts` keeps (all of them when left
   * out), the first field with one focused: those problems, none when the values pass.
   */
  readonly validate: (counts?: (issue: FormIssue) => boolean) => readonly FormIssue[];
  /**
   * Shows field `name` and puts the focus on it: its tab chosen and its **More Options** opened.
   * For a problem the form's own content found (a test of the connection, #1172).
   */
  readonly show: (name: string) => void;
};
