import type { ComponentType } from "react";

/** One choice a field offers, its label already translated. */
export type FieldChoice = { readonly label: string; readonly value: string };

/** One image a form's image choice offers (2.21): a Media image's id, name and thumbnail. */
export type ImageChoiceOption = {
  readonly value: string;
  /** Already translated, or the image's own name. */
  readonly label: string;
  /** Its thumbnail's URL. */
  readonly thumbnail: string;
};

/** Nothing besides the label and help: a kind whose renderer needs nothing more. */
type Nothing = Readonly<Record<never, never>>;

/**
 * What each kind of field's renderer needs besides its label and help (R11): the app maps its own
 * definitions (`FieldDef`) to these, so a `select` renderer always gets its options.
 */
type FieldSpecs = {
  readonly text: {
    /** Shown while the field is empty, already translated. */
    readonly placeholder?: string;
    /** What the text is, for the keyboard phones show and the browser's checks (forms, 2.21). */
    readonly inputType?: "text" | "email" | "tel" | "url";
    /** The longest text it takes: the model's limit for it (forms, 2.21). */
    readonly maxLength?: number;
  } & (
    | {
        /**
         * Why a value isn't acceptable (translated), or undefined if it is. The field then reports
         * its text only when the user is done with it (Enter or leaving it), and only if it is
         * acceptable: so on one line only.
         */
        readonly validate: (value: string) => string | undefined;
        readonly multiline?: false;
      }
    | {
        readonly validate?: undefined;
        /** Several lines, for a description or a postal address (forms, 2.21). */
        readonly multiline?: boolean;
      }
  );
  readonly select: { readonly options: readonly FieldChoice[] };
  readonly toggle: Nothing;
  /** Its steps, smallest first. */
  readonly slider: { readonly steps: readonly FieldChoice[] };
  readonly color: { readonly options: readonly FieldChoice[] };
  readonly spacing: { readonly options: readonly FieldChoice[] };
  /** The spacing tokens, and the sides it sets in order (top, right, bottom, left). */
  readonly box: {
    readonly options: readonly FieldChoice[];
    readonly sides: readonly FieldChoice[];
  };
  readonly list: {
    /** What one item is called ("Testimonial"), already translated. */
    readonly itemLabel: string;
    /** The fields of each item. */
    readonly itemFields: readonly ListItemFieldSpec[];
    /** The order of the items means nothing (attributes), so they can't be moved. */
    readonly orderless?: boolean;
    /** Its add button ("Add a profile"), already translated; "Add {item}" when left out. */
    readonly addLabel?: string;
    /** Each item's remove button ("Remove this profile"); "Delete {item}" when left out. */
    readonly removeLabel?: string;
  };
  /** Drawn by the app: where a link goes (1.19). */
  readonly link: Nothing;
  /** Drawn by the app: a Media image and its alt text (1.16). */
  readonly image: Nothing;
  /** Drawn by the app: one of Lucide's icons, chosen in the icon picker (F-ED-22). */
  readonly icon: Nothing;
  /**
   * A whole number typed in (forms, 2.21: a device's width). Its value is the text as typed; the
   * form's schema reads the number from it.
   */
  readonly number: { readonly min?: number; readonly max?: number };
  /** A time of day, `HH:MM` (forms, 2.21: opening hours). */
  readonly time: Nothing;
  /** One of a few options, side by side (forms: what a link goes to, #391). */
  readonly choice: { readonly options: readonly FieldChoice[] };
  /** Any number of its options, in their order (forms, 2.21: the days a shop opens). */
  readonly multiChoice: { readonly options: readonly FieldChoice[] };
  /** One of Media's images, or none (forms, 2.21: the site's icon and share image). */
  readonly imageChoice: {
    readonly options: readonly ImageChoiceOption[];
    /** What choosing none means ("None", "The site's image"), already translated. */
    readonly noneLabel: string;
  };
  /** Drawn by the app: code (fields/code/). */
  readonly code: Nothing;
  /**
   * Drawn by the app: one of the theme's colours (the Theme tab, 2.3a), and what it says about the
   * colour's contrast with those it is used with, already translated: nothing when it passes AA.
   */
  readonly themeColor: { readonly warnings: readonly string[] };
  /** Drawn by the app: one of the fonts the app has, chosen in the font picker (2.3a, UX-15). */
  readonly font: Nothing;
  /**
   * Drawn by the app: CSS classes (Advanced mode, F-ED-11, #276), with suggestions from the classes
   * the site's styles support as they're typed, a browser of them, and a warning for a class that
   * makes no style.
   */
  readonly classes: {
    /** Shown while the field is empty, already translated. */
    readonly placeholder?: string;
    /** Why a value isn't acceptable (translated), or undefined if it is: checked when it's done. */
    readonly validate: (value: string) => string | undefined;
  };
};

/** A kind of field: the renderer that draws it. */
export type FieldKind = keyof FieldSpecs;

/** The kinds an item of a list can have: plain values (a form's lists: times and days too). */
export type PlainFieldKind =
  | "text"
  | "select"
  | "toggle"
  | "slider"
  | "color"
  | "spacing"
  | "time"
  | "multiChoice";

/**
 * What a field renderer needs to know about its field, by its kind (`FieldSpec<"select">`, or any
 * kind). The label and help are already translated.
 */
export type FieldSpec<K extends FieldKind = FieldKind> = {
  readonly [P in K]: {
    readonly kind: P;
    readonly label: string;
    /**
     * A sentence shown under the control: what the field does that its label can't say. The
     * control is described by it (`aria-describedby`).
     */
    readonly help?: string;
  } & FieldSpecs[P];
}[K];

/** One field of a list item. */
export type ListItemFieldSpec = FieldSpec<PlainFieldKind> & {
  readonly name: string;
};

/**
 * One item of a list's value, as the site keeps it (`ListItem`): its id, which stays with it when
 * the list is reordered, and its values.
 */
export type ListItem = { readonly id: string } & Readonly<Record<string, unknown>>;

/**
 * What a `list` renderer reports through `onChange` (F-ED-6): one change to the list, so the app
 * can record it as one labelled step ("Added Testimonial").
 */
export type ListChange =
  | { readonly type: "add" }
  | { readonly type: "move"; readonly id: string; readonly to: number }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "edit"; readonly id: string; readonly name: string; readonly value: unknown };

/** Props a field renderer gets, for a field of kind `K`. */
export type FieldRendererProps<K extends FieldKind = FieldKind> = {
  /** Unique within the panel; the control's DOM id, so its label points at it. */
  readonly id: string;
  /** The label's DOM id, for controls a `<label for>` can't name (groups): `aria-labelledby`. */
  readonly labelId: string;
  /** The DOM id of the field's help text, if it has one: the control's `aria-describedby`. */
  readonly helpId?: string;
  /**
   * The DOM id of the message saying why the field's value isn't acceptable, if there is one: the
   * control is marked invalid (`aria-invalid`) and described by it.
   */
  readonly errorId?: string;
  /** The field can't be changed now: its controls are shown greyed out, and Tab skips them. */
  readonly disabled?: boolean;
  /**
   * A list's problems by item (2.21): by the item's id, then the field's name, each a translated
   * message to show by that field.
   */
  readonly itemErrors?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly field: FieldSpec<K>;
  readonly value: unknown;
  /**
   * The value changed. Called on every keystroke of a text field and every step of a slider drag,
   * once per choice elsewhere. A `list` reports a {@link ListChange} instead of the new value.
   */
  onChange(value: unknown): void;
  /**
   * The user is done with the field: it lost focus, a slider was let go, a choice was made. A run
   * of changes (typing, a drag) ends here.
   */
  onCommit(): void;
};

/** A field renderer: draws one field's control. */
export type FieldRenderer<K extends FieldKind = FieldKind> = ComponentType<FieldRendererProps<K>>;

/**
 * The renderer for each kind (1.14): the Edit panel's built-in ones, and the app's own for the
 * kinds it draws (link, image) or draws its way (colour). A kind without one isn't shown.
 */
export type FieldRenderers = { readonly [K in FieldKind]?: FieldRenderer<K> };
