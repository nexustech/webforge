// The site components' schema (R7): what a component's fields are, what they store and what its
// render receives, and what rendering is given. Types only, so it loads without React or Vite, in
// plain Node too (`@webforge/site-components/schema`): a tool can read a component's fields
// without the components themselves.

import type {
  BindableSetting,
  BoxSide,
  BoxValue,
  FormService,
  ImageValue,
  LinkValue,
  NodeDoc,
  OpeningHours,
  Responsive,
} from "@webforge/model";
import type { ComponentType, ReactNode } from "react";

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
  /**
   * A sentence the Edit panel shows under the field, already translated: what it does that its
   * label can't say ("Visitors who prefer less motion never see it move").
   */
  readonly help?: string;
  readonly responsive?: boolean;
  /**
   * The option group the Edit panel shows it in (UX-13), by its kind if not given. Fields of one
   * group are reset and opened together. `id` is what the person's closed groups are remembered by,
   * so it stays the same in every language ("typography"); `label` is translated ("Typography").
   */
  readonly optionGroup?: { readonly id: string; readonly label: string };
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
      /** What it sets: inside the element's edge, or outside it. */
      readonly property: "padding" | "margin";
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
      /** Each item's fields, never named `id`, `type` or `props` (`defineComponent` refuses them). */
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

/**
 * What elements show of Site Settings (1.17): the values text fields can be bound to, and the
 * structured ones sections list (2.8). The canvas gets them again whenever Site Settings change
 * (`CanvasEngine.setSettings`); the export from the site's snapshot. A structured setting to come
 * (social links, the logo) is a field here.
 */
export type SiteBindings = {
  /** A Site Settings value a field is bound to (1.17), or `undefined` while it is empty. */
  readonly setting: (key: BindableSetting) => string | undefined;
  /** What an empty binding shows instead: a hint on the canvas; nothing in the export. */
  readonly emptySetting?: (key: BindableSetting) => ReactNode;
  /** Site Settings' opening hours (2.8), for the Opening hours and contact section; none if left out. */
  readonly openingHours?: readonly OpeningHours[];
  /** The site's language (`en-GB`), for times and dates in its own format (2.8). */
  readonly language?: string;
  /** Where Site Settings send form submissions (F-CM-1, 2.8), if a service is chosen. */
  readonly formService?: FormService;
  /** What a form shows without a service: a hint on the canvas; nothing in the export. */
  readonly emptyFormService?: ReactNode;
};

/** What a component may need from outside its own props while rendering. */
export type RenderContext = SiteBindings & {
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
};

/**
 * The name of a script in `webforge.js` that components can need on the exported site: a file of
 * `behaviours/` without `.js` ("menu"). Generated with the scripts (`pnpm behaviours`), so a name
 * without a file is a type error; `defineComponent` checks it again for specs typed loosely.
 */
export type { BehaviourName } from "./behaviours/index.js";

/**
 * Where a component goes (F-ED-1, ADR 0005): a `section` is a band of the page, at its top level;
 * an `element` goes inside sections (and columns); `layout` is the shared Header or Footer, never
 * added to a page; a `child` exists only inside its own parent (an FAQ's questions). Only sections
 * and elements are offered in the Add panel.
 */
export type ComponentPlace = "section" | "element" | "layout" | "child";

/** The value of a choice of `options`, a field's choices. */
type ChoiceOf<Options> = Options extends readonly { readonly value: infer Value }[] ? Value : never;

/** What a field of definition `Field` stores, on one device. */
type StoredOne<Field extends FieldDef> = Field extends { readonly kind: "text" | "richtext" }
  ? string
  : Field extends { readonly kind: "select" | "spacing"; readonly options: infer Options }
    ? ChoiceOf<Options>
    : Field extends { readonly kind: "slider"; readonly steps: infer Steps }
      ? ChoiceOf<Steps>
      : Field extends { readonly kind: "color" }
        ? string
        : Field extends { readonly kind: "toggle" }
          ? boolean
          : Field extends { readonly kind: "box" }
            ? BoxValue
            : Field extends { readonly kind: "media" }
              ? ImageValue
              : Field extends { readonly kind: "link" }
                ? LinkValue
                : Field extends { readonly kind: "list" }
                  ? readonly Readonly<Record<string, unknown>>[]
                  : Field extends { readonly kind: "slot" }
                    ? readonly NodeDoc[]
                    : never;

/** What a field stores: per device too, for a field set per device (F-ED-4). */
export type StoredValue<Field extends FieldDef> = Field extends { readonly responsive: true }
  ? Responsive<StoredOne<Field>>
  : StoredOne<Field>;

/**
 * A component's defaults: a stored value for some of its `fields`. A default for a field it
 * doesn't have, or a choice it doesn't offer, is a type error.
 */
export type DefaultsOf<Fields extends Readonly<Record<string, FieldDef>>> = {
  readonly [Name in keyof Fields]?: StoredValue<Fields[Name]>;
};

/**
 * What `render` gets for a field of definition `Field`, on one device. Text edited on the canvas
 * arrives as a node ready to render; a choice is always one of its choices; an image or link is
 * there only when it's valid.
 */
type ValueOne<Field extends FieldDef> = Field extends {
  readonly kind: "text";
  readonly inline: true;
}
  ? ReactNode
  : Field extends { readonly kind: "text" }
    ? string
    : Field extends { readonly kind: "richtext" }
      ? ReactNode
      : Field extends { readonly kind: "media" }
        ? ImageValue | undefined
        : Field extends { readonly kind: "link" }
          ? // A page path or web address typed as text before link fields (older sites).
            LinkValue | string | undefined
          : Field extends { readonly kind: "list" }
            ? readonly ListItem[]
            : StoredOne<Field>;

/** What `render` gets for a field: per device too, for a field set per device (F-ED-4). */
export type FieldValue<Field extends FieldDef> = Field extends { readonly responsive: true }
  ? Responsive<ValueOne<Field>>
  : ValueOne<Field>;

/** The names of `Fields` that are slots, which `render` gets as components. */
export type SlotNames<Fields extends Readonly<Record<string, FieldDef>>> = {
  [Name in keyof Fields]: Fields[Name] extends { readonly kind: "slot" } ? Name : never;
}[keyof Fields];

/**
 * The values `render` gets: one for each field but the slots, and `variant`, the layout chosen,
 * for a component with layout variants. `bindings` says which fields show a Site Settings value
 * (see `boundText`).
 */
export type ValuesOf<
  Fields extends Readonly<Record<string, FieldDef>>,
  Variant extends string = never,
> = {
  readonly [Name in Exclude<keyof Fields, SlotNames<Fields>>]: FieldValue<Fields[Name]>;
} & ([Variant] extends [never] ? unknown : { readonly variant: Variant }) & {
    readonly bindings?: unknown;
  };

/**
 * A slot field as `render` gets it: a component that shows the slot's elements. Its `className`
 * goes on the element that holds them, Puck's drop zone on the canvas and a `<div>` in the export,
 * so a layout set there (a grid) lays out the slot's elements alike in both. Without one, the
 * export adds no element: the elements are the component's own children.
 */
export type SlotComponent = ComponentType<{ readonly className?: string }>;

/** What a component's `render` gets, from `defineComponent`'s fields. */
export type RenderPropsOf<
  Fields extends Readonly<Record<string, FieldDef>>,
  Variant extends string = never,
> = {
  readonly id: string;
  readonly values: ValuesOf<Fields, Variant>;
  /** Each slot field, as a component that shows its content. */
  readonly slots: { readonly [Name in SlotNames<Fields>]: SlotComponent };
  readonly context: RenderContext;
};
