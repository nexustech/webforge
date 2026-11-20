import type { ReactNode } from "react";
import type { FieldSpec } from "./field-spec.js";

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
  /**
   * The value may differ per device (F-ED-4) and a device other than Desktop is shown: the field
   * gets a dot saying whether it has a value of its own there (UX-19).
   */
  readonly responsive?: boolean;
  /** The value is set for this device only, overriding Desktop's (F-ED-4). */
  readonly overridden?: boolean;
  /** The value differs from the element's default, so it can be reset (UX-18). */
  readonly changed?: boolean;
  /** The field can't be changed now: shown greyed out. */
  readonly disabled?: boolean;
  /** Why its value isn't acceptable (translated), shown under its control. */
  readonly error?: string;
  /**
   * What's worth knowing about its value (translated), shown under its control with a warning sign
   * and read with its help; it never blocks: text that may be hard to read over a section's
   * background image (2.26).
   */
  readonly warning?: string;
  /**
   * Where its value comes from (3.12, CT-3), in words under its control: *Set here*, *Same as the
   * theme's look for Buttons*, *Same as theme (Corners: Medium)*. With `onReveal`, the words are a link that shows
   * where it comes from: the token in the Theme tab, the kind's look in Theme Studio.
   */
  readonly source?: FieldSource;
  /**
   * What its *Reset* is called where it isn't the default it goes back to (translated): *Reset to
   * Theme's Look* where its kind's look sets it (3.12).
   */
  readonly resetLabel?: string;
  /**
   * Its value on each device, for a field that may differ per device (SP-5): expanding it shows a
   * row per device, in this order.
   */
  readonly devices?: readonly DeviceValue[];
  /**
   * The option group it is shown in (UX-13), by its kind if not given: `id` stays the same in every
   * language and is what closed groups are remembered by, `label` is translated. Not "section":
   * that is a part of a page (glossary).
   */
  readonly optionGroup?: OptionGroup;
  /**
   * Another name the search finds it by, not translated: its CSS property, for people who know CSS
   * ("padding" for *Space inside*, F23).
   */
  readonly alsoCalled?: string;
};

/** Where a field's value comes from (CT-3); see {@link EditPanelField.source}. */
export type FieldSource = {
  /** What it says (translated). */
  readonly text: string;
  /** Shows where it comes from; without it the words are plain text. */
  readonly onReveal?: (() => void) | undefined;
};

/** A field's value on one device (SP-5). */
export type DeviceValue = {
  /** The device's id ("tablet"), as the app's {@link EditPanelProps.onChangeOn} takes it. */
  readonly id: string;
  /** Its name, translated ("Tablet"). */
  readonly label: string;
  readonly value: unknown;
  /** It has a value of its own: Desktop always, Tablet or Mobile once set there. */
  readonly own: boolean;
  /** The device shown on the canvas takes its value from this one. */
  readonly inEffect: boolean;
};

/** An option group (UX-13): a stable id ("spacing") and its translated name ("Spacing"). */
export type OptionGroup = { readonly id: string; readonly label: string };

/** An action the app adds to an option group's right-click menu, after the panel's own. */
export type GroupAction = {
  /** Translated: "Apply Look to Every Button on This Page". */
  readonly label: string;
  /** Shown greyed out when false. */
  readonly enabled?: boolean;
  onSelect(): void;
};

/** Props of {@link EditPanel}. */
export type EditPanelProps = {
  /** The selected element's name, such as "Heading"; undefined when nothing is selected. */
  readonly heading?: string | undefined;
  /** Drawn at the end of the heading's row: a **?** for the Edit panel (5.4b). */
  readonly headingAside?: ReactNode;
  readonly fields: readonly EditPanelField[];
  onChange(name: string, value: unknown): void;
  /**
   * The value of field `name` on device `device` (a {@link DeviceValue}'s id) changed, in its row
   * of the device rows (SP-5); `onCommit` ends the run as for `onChange`.
   */
  onChangeOn?(name: string, device: string, value: unknown): void;
  /** The user is done with a field (it lost focus, or a choice was made). */
  onCommit(name: string): void;
  /** The device being viewed, translated ("Mobile"), named in the override marker. */
  readonly device?: string | undefined;
  /** Drops a field's override, so the device uses the Desktop value again. */
  onReset?(name: string): void;
  /**
   * Resets fields to the element's defaults, as one step (UX-13): one from its right-click menu or
   * Ctrl/Cmd + Esc, or an option group's changed fields, `group` naming it ("Spacing").
   */
  onResetToDefault?(names: readonly string[], group?: string): void;
  /**
   * Sets fields to `values`, by name, as one step: an option group's values copied from this or
   * another element (SP-7), `group` naming it ("Spacing"). No paste without it.
   */
  onPaste?(values: Readonly<Record<string, unknown>>, group: string): void;
  /**
   * The app's own actions for the option group `id` ("appearance"), added to its right-click menu:
   * *Apply Look to Every…* for the Appearance group (2.27). None for a group it returns none for.
   */
  groupActions?(id: string): readonly GroupAction[];
  /**
   * The option groups shown closed, as `tab:id` ("style:spacing"), and how to change them: the app
   * remembers them per person (UX-13). By id, so a new language or name keeps them; per tab, as
   * each tab has its own groups. Without them the panel keeps its own, all open at first.
   */
  readonly closedGroups?: readonly string[] | undefined;
  onClosedGroupsChange?(closed: readonly string[]): void;
  /** Shows the Advanced tab and its fields (Advanced mode, F-ED-11). */
  readonly advanced?: boolean | undefined;
  /** Shows the Content tab only, without Style and Advanced (Content mode, M3). */
  readonly contentOnly?: boolean | undefined;
  /**
   * Shows the Content tab's fields as the panel's one list, without tabs: for what isn't an
   * element (the Theme tab, 2.3a).
   */
  readonly single?: boolean | undefined;
  /**
   * Which element the fields are for (its id). The fields start afresh for another element, so
   * nothing typed for one (an unfinished anchor) shows up on the next.
   */
  readonly itemKey?: string | undefined;
  /**
   * A button at the top of the Style tab that opens the element's fuller styling: *Style this
   * Feature…* (3.13a). None without it.
   */
  readonly styleAction?: { readonly label: string; readonly onSelect: () => void } | undefined;
  /** Leaves the element's name out: what holds the panel names it (*Style this Feature…*, 3.13a). */
  readonly headingHidden?: boolean | undefined;
  /** Drawn after the Advanced tab's fields: the item's CSS, read only (3.14). */
  readonly advancedFooter?: ReactNode | undefined;
  /**
   * Flows the option groups into as many columns as fit, for a panel as wide as a dialog (*Style
   * this Feature…*, Theme Studio, CT-11). Each is at least 37rem wide (481 px): wide enough for a
   * colour field's names in full, so a 1024 px window has one column, 1280 px two and 1920 px three.
   * A long group goes on in the next column, as in a newspaper, so the columns come out even; a
   * field, and a group's name with its first field, are never split.
   */
  readonly columns?: boolean | undefined;
};
