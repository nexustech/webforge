import { type ComponentType, isValidElement, type ReactNode } from "react";

/**
 * One editable property of a component, described independently of the canvas engine. `group`
 * picks the Edit panel tab (1.14): Content for what it says, Style for how it looks. When it is
 * left out, choices (`select`) are Style and everything else is Content.
 */
export type FieldDef = { readonly group?: "content" | "style" } & (
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

const EmptySlot: ComponentType = () => null;

/** The slot component for `name`, or one that renders nothing. */
export function slotComponent(props: ComponentRenderProps, name: string): ComponentType {
  return props.slots[name] ?? EmptySlot;
}
