import {
  type Breakpoint,
  isResponsiveValue,
  type Responsive,
  resolveResponsive,
} from "@webforge/model";
import { type ComponentType, isValidElement, type ReactNode } from "react";

/** A choice offered by a field: its translated label and the stored value. */
export type FieldOption = { readonly label: string; readonly value: string };

/**
 * One editable property of a component, described independently of the canvas engine.
 * - `group` picks the Edit panel tab (1.14): Content for what it says, Style for how it looks. When
 *   it is left out, the style kinds (`select`, `toggle`, `slider`, `color`, `spacing`) are Style
 *   and the rest Content.
 * - `responsive` lets the value differ per device (F-ED-4): the field then holds a
 *   {@link Responsive} value, set in the Edit panel for the device being viewed.
 */
export type FieldDef = {
  readonly group?: "content" | "style";
  readonly responsive?: boolean;
} & (
  | {
      readonly kind: "text";
      readonly label: string;
      /** Editable by clicking the text on the canvas. */
      readonly inline?: boolean;
    }
  | { readonly kind: "richtext"; readonly label: string; readonly inline?: boolean }
  | { readonly kind: "select"; readonly label: string; readonly options: readonly FieldOption[] }
  /** On or off, stored as a boolean. */
  | { readonly kind: "toggle"; readonly label: string }
  /** A step along a token scale (C4), smallest first, stored as the step's value. */
  | { readonly kind: "slider"; readonly label: string; readonly steps: readonly FieldOption[] }
  /** A colour of the site's theme (a daisyUI colour name), never a free colour (C4). */
  | { readonly kind: "color"; readonly label: string; readonly options: readonly FieldOption[] }
  /** A spacing token such as Small · Medium · Large (C4). */
  | { readonly kind: "spacing"; readonly label: string; readonly options: readonly FieldOption[] }
  | {
      readonly kind: "slot";
      readonly label: string;
      /** Component types that may be dropped into the slot; all if omitted. */
      readonly allow?: readonly string[];
    }
  /** An image from the site's media, stored as its media id. */
  | { readonly kind: "media"; readonly label: string }
);

/** A link in the site's navigation. */
export type NavLink = {
  readonly label: string;
  /** Relative URL from the page being rendered, e.g. `about.html` or `../index.html`. */
  readonly href: string;
  readonly current: boolean;
};

/** One image source set of a {@link ResolvedImage}. */
export type ImageSource = {
  readonly type: "image/webp" | "image/jpeg" | "image/png";
  /** `url width` pairs, e.g. `assets/img/hero-640.webp 640w, assets/img/hero-1280.webp 1280w`. */
  readonly srcset: string;
};

/** An image ready to render: WebP sources plus a JPEG/PNG fallback (X2). */
export type ResolvedImage = {
  readonly sources: readonly ImageSource[];
  /** The fallback image: its largest width, for browsers without `srcset`. */
  readonly src: string;
  readonly fallback: ImageSource;
  readonly width: number;
  readonly height: number;
};

/** What a component may need from outside its own props while rendering. */
export type RenderContext = {
  /** The site's pages, for navigation. Empty on the canvas. */
  readonly navigation: readonly NavLink[];
  /** The relative URL of a page path (`about`) or the link itself if it is external. */
  readonly link: (target: string) => string;
  /** The image for a media id, or `null` if there is none (yet). */
  readonly image: (mediaId: string) => ResolvedImage | null;
};

/** The context on the editor canvas: no site navigation, links go nowhere, no images yet. */
export const EDITOR_RENDER_CONTEXT: RenderContext = {
  navigation: [],
  link: () => "#",
  image: () => null,
};

/** Props a component's `render` receives. */
export type ComponentRenderProps = {
  readonly id: string;
  /** Field values by field name. Inline-editable text arrives as a ready-to-render node. */
  readonly values: Readonly<Record<string, unknown>>;
  /** Slot fields, rendered as components that show their content. */
  readonly slots: Readonly<Record<string, ComponentType>>;
  readonly context: RenderContext;
};

/** Names of the scripts in `webforge.js` that components can need on the exported site. */
export type BehaviourName = "menu";

/** A section or element users can add to a page. */
export type ComponentDef = {
  /** Display name, already translated (glossary terms: "Heading", "Section"). */
  readonly label: string;
  readonly fields: Readonly<Record<string, FieldDef>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly render: (props: ComponentRenderProps) => ReactNode;
  /** Scripts the exported site must include when this component is used. */
  readonly behaviours?: readonly BehaviourName[];
};

/** The components available on the canvas and in exported sites, by component type. */
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

/** Narrows a plain-text value (e.g. a link target or alt text) to a string. */
export function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Narrows a select field value to one of `options`, falling back to the first. */
export function optionValue<T extends string>(value: unknown, options: readonly [T, ...T[]]): T {
  return options.find((option) => option === value) ?? options[0];
}

/** Where each device's classes start, mobile first: Tablet from `md`, Desktop from `lg`. */
const BREAKPOINT_PREFIX: readonly (readonly [Breakpoint, string])[] = [
  ["mobile", ""],
  ["tablet", "md:"],
  ["desktop", "lg:"],
];

/**
 * The classes for a value that may differ per device (F-ED-4), mobile first: the Mobile value's
 * classes as they are, then Tablet's with `md:` and Desktop's with `lg:` where they differ from the
 * device before. A plain value gives its classes alone. `classesFor` maps one value to its
 * classes, e.g. a padding token to `py-16`.
 */
export function responsiveClasses<T>(
  value: unknown,
  classesFor: (value: T | undefined) => string,
): string {
  if (!isResponsiveValue(value as Responsive<T>)) {
    return classesFor(value as T);
  }
  const parts: string[] = [];
  let previous: string | undefined;
  for (const [breakpoint, prefix] of BREAKPOINT_PREFIX) {
    const classes = classesFor(resolveResponsive(value as Responsive<T>, breakpoint));
    if (classes !== previous) {
      parts.push(
        ...classes
          .split(/\s+/)
          .filter((name) => name !== "")
          .map((name) => `${prefix}${name}`),
      );
    }
    previous = classes;
  }
  return parts.join(" ");
}

const EmptySlot: ComponentType = () => null;

/** The slot component for `name`, or one that renders nothing. */
export function slotComponent(props: ComponentRenderProps, name: string): ComponentType {
  return props.slots[name] ?? EmptySlot;
}
