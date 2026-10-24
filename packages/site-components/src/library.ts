import {
  BOX_SIDES,
  type BoxSide,
  type Breakpoint,
  bindingOf,
  formatColorRef,
  isResponsiveValue,
  type LinkValue,
  linkValueSchema,
  type NodeDoc,
  nodeAdvancedSchema,
  parseColorRef,
  type Responsive,
  resolveResponsive,
  responsiveBoxOf,
  type SpacingToken,
  type TextStyle,
} from "@webforge/model";
import { type ComponentType, cloneElement, isValidElement, type ReactNode } from "react";
import { isDocumentPath } from "./document-path.js";
import type {
  BehaviourName,
  ComponentPlace,
  FieldDef,
  RenderContext,
  SlotComponent,
} from "./schema.js";

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
  /** Slot fields, rendered as components that show their content (see {@link SlotComponent}). */
  readonly slots: Readonly<Record<string, SlotComponent>>;
  readonly context: RenderContext;
};

/** A section or element users can add to a page. */
export type ComponentDef = {
  /** Display name, already translated (glossary terms: "Heading", "Section"). */
  readonly label: string;
  /** Where it goes; an element when left out. */
  readonly place?: ComponentPlace;
  /** Its group in the Add panel, already translated ("Heroes", "Text"). */
  readonly category?: string;
  /** Set on a section {@link defineSection} framed: every section is (2.19). */
  readonly framed?: true;
  readonly fields: Readonly<Record<string, FieldDef>>;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly render: (props: ComponentRenderProps) => ReactNode;
  /**
   * Scripts the exported site must include when this component is used: always, or as its values
   * (with its defaults) ask (a Header's `sticky` behaviour only when it is sticky).
   */
  readonly behaviours?:
    | readonly BehaviourName[]
    | ((values: Readonly<Record<string, unknown>>) => readonly BehaviourName[]);
  /**
   * The theme's text style its text is set in (h1–h6, body, small), from its values with their
   * defaults; none for a component without text of its own. Sets how much contrast a colour on it
   * needs (WCAG AA's large text, 1.37).
   */
  readonly textStyle?: (values: Readonly<Record<string, unknown>>) => TextStyle | undefined;
};

/**
 * The class that gives an element the colour a colour field stores (1.37, ADR 0009): `prefix` and
 * the colour ref, `text-primary-300/80` or `bg-[#1f6feb]/50`. None for `default` (the element's
 * own colour) or anything that isn't a colour ref, so nothing else can reach a class.
 */
export function colorClass(prefix: "text" | "bg" | "border", value: unknown): string {
  if (typeof value !== "string" || value === "default") return "";
  const parsed = parseColorRef(value);
  return parsed === undefined ? "" : `${prefix}-${formatColorRef(parsed)}`;
}

/**
 * The text styles `node`'s text is set in, one for each device its values differ on (a size set per
 * device, F-ED-4), else just one; none for a component that declares none.
 */
export function textStylesOf(node: NodeDoc, library: ComponentLibrary): TextStyle[] {
  const def = library.components[node.type];
  if (def?.textStyle === undefined) return [];
  const values: Readonly<Record<string, unknown>> = { ...def.defaults, ...node.props };
  const responsive = Object.values(values).some((value) => isResponsiveValue(value));
  const devices: readonly Breakpoint[] = responsive ? ["desktop", "tablet", "mobile"] : ["desktop"];
  const styles = devices.map((device) =>
    def.textStyle?.(
      Object.fromEntries(
        Object.entries(values).map(([name, value]) => [name, resolveResponsive(value, device)]),
      ),
    ),
  );
  return [...new Set(styles.filter((style) => style !== undefined))];
}

/** The components available on the canvas and in exported sites, by component type. */
export type ComponentLibrary = {
  readonly components: Readonly<Record<string, ComponentDef>>;
};

/**
 * A text field's content: the Site Settings value it is bound to (1.17), else its own text. An
 * empty binding shows the context's hint on the canvas and nothing in the export.
 */
export function boundText<Values extends Readonly<Record<string, unknown>>>(
  values: Values,
  name: keyof Values & string,
  context: RenderContext,
): ReactNode {
  const key = bindingOf(values.bindings, name);
  if (key === undefined) {
    return textValue(values[name]);
  }
  return context.setting(key) ?? context.emptySetting?.(key) ?? null;
}

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
  value: Responsive<T>,
  classesFor: (value: T) => string,
): string {
  if (!isResponsiveValue(value)) {
    return classesFor(value);
  }
  const parts: string[] = [];
  let previous: string | undefined;
  for (const [breakpoint, prefix] of BREAKPOINT_PREFIX) {
    const classes = classesFor(resolveResponsive(value, breakpoint));
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

/** How many CSS pixels each token of `property` is, as {@link boxClasses} styles it. */
export function boxTokenPixels(
  property: "padding" | "margin",
): Readonly<Record<SpacingToken, number>> {
  const units = BOX_UNITS[property === "padding" ? "p" : "m"];
  return Object.fromEntries(
    Object.entries(units).map(([token, size]) => [token, size * TAILWIND_UNIT_PX]),
  ) as Record<SpacingToken, number>;
}

/** CSS pixels per Tailwind spacing unit. */
const TAILWIND_UNIT_PX = 4;

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
 * Every class {@link boxClasses} can give, with the sizes the site's components use for sides left
 * unset. The canvas compiles them all (1.32), so a size dragged to with a spacing handle is styled
 * at once rather than once the canvas's CSS is compiled again; the export compiles only those used.
 */
export const BOX_CLASS_SAFELIST: readonly string[] = (() => {
  const sizes = [...new Set([...Object.values(BOX_UNITS.p), ...Object.values(BOX_UNITS.m), 4])];
  const prefixes = new Set([
    ...BREAKPOINT_PREFIX.map(([, prefix]) => prefix),
    ...Object.values(DEVICE_RANGE),
  ]);
  return [...prefixes].flatMap((prefix) =>
    (["p", "m"] as const).flatMap((kind) =>
      ["x", "y", "t", "r", "b", "l"].flatMap((side) =>
        sizes.map((size) => `${prefix}${kind}${side}-${size}`),
      ),
    ),
  );
})();

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

const EmptySlot: SlotComponent = () => null;

/** The slot component for `name`, or one that renders nothing. */
export function slotComponent(props: ComponentRenderProps, name: string): SlotComponent {
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
