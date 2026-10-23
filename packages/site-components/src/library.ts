import {
  type BindableSetting,
  BOX_SIDES,
  type BoxSide,
  type Breakpoint,
  bindingOf,
  isResponsiveValue,
  type LinkValue,
  linkValueSchema,
  nodeAdvancedSchema,
  type Responsive,
  resolveResponsive,
  responsiveBoxOf,
  type SpacingToken,
} from "@webforge/model";
import { type ComponentType, cloneElement, isValidElement, type ReactNode } from "react";
import { isDocumentPath } from "./document-path.js";

/** A choice offered by a field: its translated label and the stored value. */
export type FieldOption = { readonly label: string; readonly value: string };

/**
 * One editable property of a component, described independently of the canvas engine.
 * - `group` picks the Edit panel tab (1.14): Content for what it says, Style for how it looks. When
 *   it is left out, the style kinds (`select`, `toggle`, `slider`, `color`, `spacing`, `box`) are
 *   Style and the rest Content.
 * - `responsive` lets the value differ per device (F-ED-4): the field then holds a
 *   {@link Responsive} value, set in the Edit panel for the device being viewed.
 *
 * A `slot` that allows one component type only (a FAQ's questions) is edited in the Edit panel as
 * a repeating list too (F-ED-6), its items being those elements.
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
      /**
       * Site Settings values the field can show instead of its own text (1.17), typed once in
       * Site Settings and updated on every page. The choice is stored in the element's
       * `props.bindings`; render the field with {@link boundText}.
       */
      readonly bindable?: readonly BindableSetting[];
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
  /**
   * Padding or margin per side (1.32), stored as a `BoxValue`: a spacing token for each side set.
   * Render it with {@link boxClasses}.
   */
  | {
      readonly kind: "box";
      readonly label: string;
      /** The sides that can be set; all four if omitted. */
      readonly sides?: readonly BoxSide[];
    }
  | {
      readonly kind: "slot";
      readonly label: string;
      /** Component types that may be dropped into the slot; all if omitted. */
      readonly allow?: readonly string[];
      /**
       * The place whose components the slot holds (a Section's: `element`); `createLibrary` lists
       * them in `allow`, so a new element goes into sections without each slot naming it.
       */
      readonly accepts?: ComponentPlace;
    }
  /**
   * An image from the site's Media, stored as an `ImageValue`: `{ mediaId, alt? }`, where `alt`
   * overrides the image's own alt text for this placement (G15).
   */
  | { readonly kind: "media"; readonly label: string }
  /**
   * Where a link goes (F-ED-18), stored as a `LinkValue`: a page of the site (optionally a section
   * on it), an e-mail address, a phone number or a web address, optionally in a new tab.
   */
  | { readonly kind: "link"; readonly label: string }
  /**
   * A repeating list (F-ED-6), such as testimonials or opening hours, stored as an array of
   * {@link ListItem}s. Items are added, reordered and removed in the Edit panel.
   */
  | {
      readonly kind: "list";
      readonly label: string;
      /** What one item is called, already translated: "Testimonial". */
      readonly itemLabel: string;
      /** Each item's fields. Never named `id`, `type` or `props`: see {@link ListItem}. */
      readonly fields: Readonly<Record<string, ListItemFieldDef>>;
      /** A new item's values. */
      readonly defaults: Readonly<Record<string, unknown>>;
    }
);

/**
 * The kinds of field a list item can have: plain values, edited in the item's row. An item's value
 * is the same on every device.
 */
export type ListItemFieldDef = Extract<
  FieldDef,
  { readonly kind: "text" | "select" | "toggle" | "slider" | "color" | "spacing" }
> & { readonly responsive?: false };

/**
 * One item of a `list` field: its values and an id that stays with it when the list is reordered.
 * It has no `type` and `props`, so it is never mistaken for an element (`NodeDoc`).
 */
export type ListItem = { readonly id: string } & Readonly<Record<string, unknown>>;

/** A link in the site's navigation. */
export type NavLink = {
  /** The menu item (or page) it comes from: two items can go to the same address. */
  readonly id?: string;
  readonly label: string;
  /** Relative URL from the page being rendered, e.g. `about.html` or `../index.html`. */
  readonly href: string;
  readonly current: boolean;
  /** Shown as a button, e.g. "Book now" (F-ED-17). */
  readonly button?: boolean;
  /** Opens in a new tab. */
  readonly newTab?: boolean;
  /** A document saved rather than opened (1.28). */
  readonly download?: boolean;
};

/** A dropdown in the site's navigation (F-ED-17): its links, one level deep. */
export type NavGroup = {
  /** The menu item it comes from. */
  readonly id?: string;
  readonly label: string;
  readonly children: readonly NavLink[];
  /** Whether one of its links is the page being rendered. */
  readonly current: boolean;
};

/** An item of the site's navigation: a link, or a dropdown of links. */
export type NavItem = NavLink | NavGroup;

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
  /** The image's own alt text from Media; a placement may override it. */
  readonly alt: string;
  /** Where to keep the image in view when it is cut to fit (`object-position`, G14). */
  readonly objectPosition?: string;
  /**
   * Show the image at this shape (`aspect-ratio`, e.g. `1 / 1`), cut to fit around
   * `objectPosition`. Set on the canvas, which shows the uncut original; exports cut the files.
   */
  readonly aspectRatio?: string;
};

/** What a component may need from outside its own props while rendering. */
export type RenderContext = {
  /** The site's pages, for navigation. Empty on the canvas. */
  readonly navigation: readonly NavItem[];
  /** The relative URL of a page path (`about`) or the link itself if it is external. */
  readonly link: (target: string) => string;
  /**
   * Where a link field's value goes (F-ED-18): a page by its id, as a relative URL (with
   * `#anchor` for a section), `mailto:`, `tel:` or the web address. `#` when it goes nowhere.
   */
  readonly href: (link: LinkValue) => string;
  /** The image for a media id, or `null` if there is none (yet). */
  readonly image: (mediaId: string) => ResolvedImage | null;
  /** A Site Settings value a field is bound to (1.17), or `undefined` while it is empty. */
  readonly setting: (key: BindableSetting) => string | undefined;
  /** What an empty binding shows instead: a hint on the canvas; nothing in the export. */
  readonly emptySetting?: (key: BindableSetting) => ReactNode;
};

/** The context on the editor canvas: no site navigation, links go nowhere, no images yet. */
export const EDITOR_RENDER_CONTEXT: RenderContext = {
  navigation: [],
  link: () => "#",
  href: () => "#",
  image: () => null,
  setting: () => undefined,
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

/**
 * The name of a script in `webforge.js` that components can need on the exported site: a file of
 * `behaviours/` without `.js` ("menu"). `defineComponent` checks that it exists.
 */
export type BehaviourName = string;

/**
 * Where a component goes (F-ED-1, ADR 0005): a `section` is a band of the page, at its top level;
 * an `element` goes inside sections (and columns); `layout` is the shared Header or Footer, never
 * added to a page; a `child` exists only inside its own parent (an FAQ's questions). Only sections
 * and elements are offered in the Add panel.
 */
export type ComponentPlace = "section" | "element" | "layout" | "child";

/** A section or element users can add to a page. */
export type ComponentDef = {
  /** Display name, already translated (glossary terms: "Heading", "Section"). */
  readonly label: string;
  /** Where it goes; an element when left out. */
  readonly place?: ComponentPlace;
  /** Its group in the Add panel, already translated ("Heroes", "Text"). */
  readonly category?: string;
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
/**
 * A text field's content: the Site Settings value it is bound to (1.17), else its own text. An
 * empty binding shows the context's hint on the canvas and nothing in the export.
 */
export function boundText(
  values: Readonly<Record<string, unknown>>,
  name: string,
  context: RenderContext,
): ReactNode {
  const key = bindingOf(values.bindings, name);
  if (key === undefined) {
    return textValue(values[name]);
  }
  return context.setting(key) ?? context.emptySetting?.(key) ?? null;
}

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

/** The attributes of an `<a>` for a link field's value. */
export type LinkAttributes = {
  readonly href: string;
  readonly target?: "_blank";
  readonly rel?: "noopener";
  /** A document saved rather than opened (1.28). */
  readonly download?: "";
};

/**
 * The `href` (and `target`/`rel` for a new tab, `download` for a document to save) of a link
 * field's value: a `LinkValue`, or a page path or web address typed as text before link fields
 * (older sites). No value links to `#`.
 */
export function linkAttributes(value: unknown, context: RenderContext): LinkAttributes {
  const link = linkValueSchema.safeParse(value);
  if (link.success) {
    const href = context.href(link.data);
    return {
      href,
      ...(link.data.newTab === true ? { target: "_blank", rel: "noopener" } : {}),
      // Only on the document's own file: a deleted one links to `#`, which mustn't be saved.
      ...(link.data.kind === "file" && link.data.download === true && isDocumentPath(href)
        ? { download: "" }
        : {}),
    };
  }
  const text = stringValue(value);
  return { href: text === "" ? "#" : context.link(text) };
}

/** A link field's value, if it holds one. */
export function linkValue(value: unknown): LinkValue | undefined {
  const link = linkValueSchema.safeParse(value);
  return link.success ? link.data : undefined;
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
 * classes, e.g. a padding token to `py-16`; it must give every value classes of its own
 * (`space-y-0` for none, not nothing), so a larger device can undo a smaller one's.
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

/** Tailwind spacing units of each token (C4): padding and margin have scales of their own. */
const BOX_UNITS: Readonly<Record<"p" | "m", Readonly<Record<SpacingToken, number>>>> = {
  p: { none: 0, s: 8, m: 16, l: 24, xl: 32 },
  m: { none: 0, s: 4, m: 8, l: 16, xl: 24 },
};

/** A box's sides in pairs, with their class names: left and right (`px-`), then top and bottom. */
const BOX_AXES = [
  ["x", ["left", "l"], ["right", "r"]],
  ["y", ["top", "t"], ["bottom", "b"]],
] as const;

/** The variant for a run of devices, smallest first: `max-md:` for Mobile alone, and so on. */
const DEVICE_RANGE: Readonly<Record<string, string>> = {
  mobile: "max-md:",
  tablet: "md:max-lg:",
  desktop: "lg:",
  "mobile tablet": "max-lg:",
  "tablet desktop": "md:",
  "mobile tablet desktop": "",
};

/**
 * The classes for a `box` field (1.32): `pl-`, `pr-`, `pt-` and `pb-` (or `m…` for margin), as
 * `px-` or `py-` where the two sides are the same.
 * - `defaults` gives a side left unset its Tailwind units, e.g. `{ top: 16, bottom: 16 }` for
 *   `py-16`. A side with no default gets no class, so it keeps the spacing around it: an
 *   element's margin is otherwise its section's space between elements.
 * - `sides` limits the sides read, e.g. top and bottom for a margin whose sides are `auto`.
 *
 * The classes of a value set per device are mobile first, like {@link responsiveClasses}, while
 * every device gives each side a class. Otherwise each device's classes apply on that device only
 * (`max-md:`, `md:max-lg:`, `lg:`), so a side unset on one device needs no class there.
 */
export function boxClasses(
  value: unknown,
  property: "padding" | "margin",
  defaults: Partial<Record<BoxSide, number>> = {},
  sides: readonly BoxSide[] = BOX_SIDES,
): string {
  const kind = property === "padding" ? "p" : "m";
  const units = BOX_UNITS[kind];
  const stored = responsiveBoxOf(value);
  const parts: string[] = [];
  for (const [axis, ...pair] of BOX_AXES) {
    const read = pair.filter(([side]) => sides.includes(side));
    let complete = true;
    const perDevice = BREAKPOINT_PREFIX.map(([breakpoint, prefix]) => {
      const box = resolveResponsive(stored, breakpoint);
      const sizes = read.map(([side, short]) => {
        const token = box[side];
        const size = token === undefined ? defaults[side] : units[token];
        if (size === undefined) complete = false;
        return [short, size] as const;
      });
      const [first, second] = sizes;
      const classes =
        sizes.length === 2 && first?.[1] !== undefined && first[1] === second?.[1]
          ? [`${kind}${axis}-${first[1]}`]
          : sizes.flatMap(([short, size]) =>
              size === undefined ? [] : [`${kind}${short}-${size}`],
            );
      return { breakpoint, prefix, classes, joined: classes.join(" ") };
    });
    if (complete) {
      let previous: string | undefined;
      for (const { prefix, classes, joined } of perDevice) {
        if (joined !== previous) parts.push(...classes.map((name) => `${prefix}${name}`));
        previous = joined;
      }
      continue;
    }
    // Each run of devices with the same classes gets them for those devices only.
    let start = 0;
    for (const [index, device] of perDevice.entries()) {
      if (perDevice[index + 1]?.joined === device.joined) continue;
      const run = perDevice.slice(start, index + 1).map(({ breakpoint }) => breakpoint);
      const range = DEVICE_RANGE[run.join(" ")] ?? "";
      parts.push(...device.classes.map((name) => `${range}${name}`));
      start = index + 1;
    }
  }
  return parts.join(" ");
}

const EmptySlot: ComponentType = () => null;

/** The slot component for `name`, or one that renders nothing. */
export function slotComponent(props: ComponentRenderProps, name: string): ComponentType {
  return props.slots[name] ?? EmptySlot;
}

/** Attribute names React expects in camel case; the others pass as they are. */
const REACT_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = { tabindex: "tabIndex" };

/**
 * A component's output with the node's Advanced-mode options (F-ED-11) on its root element: the
 * extra classes after its own, the attributes, and the anchor as its `id`. The options are checked
 * again here, so nothing outside the allow-list reaches a page whatever the document holds. Output
 * whose root isn't an HTML element is left as it is.
 */
export function withAdvanced(output: ReactNode, advanced: unknown): ReactNode {
  if (advanced === undefined || !isValidElement(output) || typeof output.type !== "string") {
    return output;
  }
  const parsed = nodeAdvancedSchema.safeParse(advanced);
  if (!parsed.success) {
    return output;
  }
  const { className, attributes = {}, anchorId } = parsed.data;
  const own = (output.props as { readonly className?: unknown }).className;
  return cloneElement(output, {
    ...Object.fromEntries(
      Object.entries(attributes).map(([name, value]) => [
        REACT_ATTRIBUTE_NAMES[name] ?? name,
        value,
      ]),
    ),
    ...(anchorId === undefined || anchorId === "" ? {} : { id: anchorId }),
    ...(className === undefined || className === ""
      ? {}
      : { className: typeof own === "string" && own !== "" ? `${own} ${className}` : className }),
  } as Record<string, unknown>);
}
