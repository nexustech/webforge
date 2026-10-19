import { type ComponentType, isValidElement, type ReactNode } from "react";

/** One editable property of a component, described independently of the canvas engine. */
export type FieldDef =
  | {
      readonly kind: "text";
      readonly label: string;
      /** Editable by clicking the text on the canvas. */
      readonly inline?: boolean;
    }
  | { readonly kind: "richtext"; readonly label: string; readonly inline?: boolean }
  | {
      readonly kind: "select";
      readonly label: string;
      readonly options: readonly { readonly label: string; readonly value: string }[];
    }
  | {
      readonly kind: "slot";
      readonly label: string;
      /** Component types that may be dropped into the slot; all if omitted. */
      readonly allow?: readonly string[];
    };

/** Props a component's `render` receives. */
export type ComponentRenderProps = {
  readonly id: string;
  /** Field values by field name. Inline-editable text arrives as a ready-to-render node. */
  readonly values: Readonly<Record<string, unknown>>;
  /** Slot fields, rendered as components that show their content. */
  readonly slots: Readonly<Record<string, ComponentType>>;
};

/** A section or element users can add to a page. */
export type ComponentDef = {
  /** Display name, already translated (glossary terms: "Heading", "Section"). */
  readonly label: string;
  readonly fields: Readonly<Record<string, FieldDef>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly render: (props: ComponentRenderProps) => ReactNode;
};

/** The components available on the canvas, by component type. */
export type ComponentLibrary = {
  readonly components: Readonly<Record<string, ComponentDef>>;
};

/** Narrows a text field value for rendering: strings, numbers and elements pass, others are empty. */
export function textValue(value: unknown): ReactNode {
  if (typeof value === "string" || typeof value === "number" || isValidElement(value)) {
    return value;
  }
  return null;
}

/** Narrows a select field value to one of `options`, falling back to the first. */
export function optionValue<T extends string>(value: unknown, options: readonly [T, ...T[]]): T {
  return options.find((option) => option === value) ?? options[0];
}

const EmptySlot: ComponentType = () => null;

/** The slot component for `name`, or one that renders nothing. */
export function slotComponent(props: ComponentRenderProps, name: string): ComponentType {
  return props.slots[name] ?? EmptySlot;
}
