import { t } from "@webforge/i18n";
import { type Breakpoint, type Responsive, resolveResponsive } from "@webforge/model";
import { createContext, type ReactNode, useContext } from "react";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import { isIconName, LucideIcon } from "../icons.js";
import { type ComponentDef, colorClass, linkAttributes, responsiveClasses } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
  HOVER_FIELD,
  hoverClasses,
} from "../motion.js";
import { Picture } from "../picture.js";
import { PREVIEW_ATTRIBUTE } from "../previews.js";
import type { FieldDef, ResolvedImage } from "../schema.js";
import { SocialLogo, socialName } from "../social-icons.js";
import { BODY_TEXT_CLASSES, BUTTON_CLASSES } from "../typography.js";
import {
  COLUMN_LAYOUT_CLASS,
  COLUMN_LAYOUTS,
  type ColumnLayout,
  ColumnsLayoutContext,
  imageSizes,
  MAX_COLUMNS,
} from "./column-layouts.js";

const ALIGNMENTS = ["left", "centre", "right"] as const;
/** Where an element sits across its section: Left, Centre or Right. */
const ALIGNMENT_FIELD = {
  kind: "select",
  label: t("field.alignment"),
  options: ALIGNMENTS.map((value) => ({ label: t(`field.alignment.${value}`), value })),
} as const satisfies FieldDef;

const IMAGE_WIDTHS = ["small", "medium", "large", "full"] as const;
/**
 * An Image's width tokens (2.17's handles snap to them): at most this wide, never wider than its
 * column. Full width says so, so a narrower width on a smaller device doesn't carry on above it.
 */
const IMAGE_WIDTH_CLASS = {
  small: "max-w-xs",
  medium: "max-w-md",
  large: "max-w-2xl",
  full: "max-w-none",
} as const;
/** How wide each width token lets an Image be, in pixels (`max-w-xs` is 20rem); full has no cap. */
const IMAGE_WIDTH_PX = { small: 320, medium: 448, large: 672, full: undefined } as const;
/** An Image across its section, by its alignment. */
const IMAGE_ALIGN_CLASS = { left: "mr-auto", centre: "mx-auto", right: "ml-auto" } as const;

/**
 * An Image's picture, asking for a file no wider than it shows (X2): its width token on each
 * device, and in Columns the widest its column can be. A component, so it can read the Columns
 * it is in on the canvas as in the export.
 */
function ImagePicture({
  image,
  alt,
  width,
  rounded,
}: {
  readonly image: ResolvedImage;
  readonly alt: string;
  readonly width: Responsive<(typeof IMAGE_WIDTHS)[number]>;
  readonly rounded: boolean;
}) {
  const layout = useContext(ColumnsLayoutContext);
  const maxPx = (breakpoint: Breakpoint) => IMAGE_WIDTH_PX[resolveResponsive(width, breakpoint)];
  return (
    <Picture
      image={image}
      alt={alt}
      sizes={imageSizes(maxPx, layout)}
      className={rounded ? "h-auto w-full rounded-box" : "h-auto w-full"}
    />
  );
}

/**
 * An image from Media (F-ED-5), as wide as its width token lets it, with its focal point kept in
 * view (F-ED-21) and an optional caption. Without an image it shows a hint on the canvas and
 * nothing in the export.
 */
const image = defineComponent({
  label: t("element.image"),
  category: t("category.media"),
  fields: {
    image: { kind: "media", label: t("field.image") },
    width: {
      kind: "slider",
      label: t("field.imageWidth"),
      responsive: true,
      steps: IMAGE_WIDTHS.map((value) => ({ label: t(`field.imageWidth.${value}`), value })),
      // The canvas's width handles snap to these (2.17); full is as wide as the column.
      widths: Object.fromEntries(
        IMAGE_WIDTHS.map((value) => [value, IMAGE_WIDTH_PX[value] ?? null]),
      ),
    },
    alignment: ALIGNMENT_FIELD,
    rounded: { kind: "toggle", label: t("field.rounded"), group: "style" },
    caption: { kind: "text", label: t("field.caption") },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: { width: "full", alignment: "centre", rounded: false, caption: "" },
  behaviours: entranceBehaviours,
  render: ({ values, context }) => {
    const placed = values.image;
    const resolved = placed === undefined ? null : context.image(placed.mediaId);
    const width = responsiveClasses(values.width, (value) => IMAGE_WIDTH_CLASS[value]);
    const frame = `site-image w-full ${IMAGE_ALIGN_CLASS[values.alignment]} ${width}${marginClasses(values.margin)}${entranceClasses(values)}`;
    const entrance = entranceAttributes(values);
    if (resolved === null) {
      const hint = context.emptyImage?.();
      return hint === undefined ? null : (
        <div
          className={`${frame} flex aspect-video items-center justify-center rounded-box border-2 border-base-300 border-dashed p-4 text-center text-sm`}
          {...entrance}
        >
          {hint}
        </div>
      );
    }
    const caption = values.caption.trim();
    return (
      <figure className={frame} {...entrance}>
        <ImagePicture
          image={resolved}
          alt={placed?.alt ?? resolved.alt}
          width={values.width}
          rounded={values.rounded}
        />
        {caption === "" ? null : (
          <figcaption className="mt-2 text-center text-sm">{caption}</figcaption>
        )}
      </figure>
    );
  },
});

const BUTTON_STYLES = ["primary", "secondary", "outline"] as const;
const BUTTON_SIZES = ["small", "medium", "large"] as const;
/** A Button's classes by its style and size, all from the catalogue's button classes (2.19). */
const BUTTON_KIND = {
  primary: { small: "primarySmall", medium: "primary", large: "primaryLarge" },
  secondary: { small: "secondarySmall", medium: "secondary", large: "secondaryLarge" },
  outline: { small: "outlineSmall", medium: "outline", large: "outlineLarge" },
} as const satisfies Record<string, Record<string, keyof typeof BUTTON_CLASSES>>;
/** A Button across its section, by its alignment. */
const BUTTON_ALIGN_CLASS = {
  left: "justify-start",
  centre: "justify-center",
  right: "justify-end",
} as const;

/** A link drawn as a button: its text, where it goes, its style and size. */
const button = defineComponent({
  label: t("element.button"),
  category: t("category.basic"),
  fields: {
    label: { kind: "text", label: t("field.buttonLabel") },
    link: { kind: "link", label: t("field.buttonLink") },
    // Before its text (F-ED-22), in the text's size and colour.
    icon: { kind: "icon", label: t("field.icon") },
    style: {
      kind: "select",
      label: t("field.buttonStyle"),
      options: BUTTON_STYLES.map((value) => ({ label: t(`field.buttonStyle.${value}`), value })),
    },
    size: {
      kind: "select",
      label: t("field.size"),
      options: BUTTON_SIZES.map((value) => ({ label: t(`field.size.${value}`), value })),
    },
    alignment: ALIGNMENT_FIELD,
    hover: HOVER_FIELD,
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  behaviours: entranceBehaviours,
  defaults: {
    label: t("starter.buttonLabel"),
    style: "primary",
    size: "medium",
    alignment: "left",
  },
  render: ({ values, context }) => {
    const label = values.label.trim();
    return (
      <div
        className={`site-button flex ${BUTTON_ALIGN_CLASS[values.alignment]}${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        {label === "" ? null : (
          <a
            className={`${BUTTON_CLASSES[BUTTON_KIND[values.style][values.size]]}${hoverClasses(values.hover)}`}
            {...linkAttributes(values.link, context)}
          >
            {values.icon === undefined ? null : <LucideIcon name={values.icon} />}
            {label}
          </a>
        )}
      </div>
    );
  },
});

const SPACER_HEIGHTS = ["small", "medium", "large", "xlarge"] as const;
const SPACER_HEIGHT_CLASS = { small: "h-4", medium: "h-8", large: "h-16", xlarge: "h-24" } as const;

/** Empty space between elements, taller or shorter per device. */
const spacer = defineComponent({
  label: t("element.spacer"),
  category: t("category.basic"),
  fields: {
    height: {
      kind: "slider",
      label: t("field.spacerHeight"),
      responsive: true,
      steps: SPACER_HEIGHTS.map((value) => ({ label: t(`field.spacerHeight.${value}`), value })),
    },
  },
  defaults: { height: "medium" },
  render: ({ values }) => (
    <div
      className={`site-spacer ${responsiveClasses(values.height, (value) => SPACER_HEIGHT_CLASS[value])}`}
      aria-hidden="true"
    />
  ),
});

/** A line between elements, with an optional word on it ("or"). */
const divider = defineComponent({
  label: t("element.divider"),
  category: t("category.basic"),
  fields: {
    text: { kind: "text", label: t("field.dividerText") },
    margin: MARGIN_FIELD,
  },
  defaults: { text: "" },
  render: ({ values }) => {
    const text = values.text.trim();
    const margin = marginClasses(values.margin);
    // A plain line is a thematic break; one with a word is daisyUI's divider, its word read out.
    return text === "" ? (
      <hr className={`site-divider my-4 border-base-content/10${margin}`} />
    ) : (
      <div className={`site-divider divider${margin}`}>{text}</div>
    );
  },
});

const COLUMN_GAPS = ["small", "medium", "large"] as const;
const COLUMN_GAP_CLASS = { small: "gap-4", medium: "gap-8", large: "gap-12" } as const;

/**
 * Columns side by side (T3): one to four Column elements, each holding elements, laid out per
 * device: equal widths, one wide column, or stacked one under another, as they are on Mobile at
 * first. 2.17's toolbar adds, removes and lays them out.
 */
const columns = defineComponent({
  label: t("element.columns"),
  category: t("category.layout"),
  fields: {
    columns: { kind: "slot", label: t("field.columns"), allow: ["Column"], max: MAX_COLUMNS },
    layout: {
      kind: "select",
      label: t("field.columnLayout"),
      responsive: true,
      options: COLUMN_LAYOUTS.map((value) => ({ label: t(`field.columnLayout.${value}`), value })),
    },
    gap: {
      kind: "slider",
      label: t("field.columnGap"),
      responsive: true,
      steps: COLUMN_GAPS.map((value) => ({ label: t(`field.columnGap.${value}`), value })),
    },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  behaviours: entranceBehaviours,
  defaults: {
    columns: [0, 1].map((index) => ({
      type: "Column",
      props: {
        // Placing a Columns gives every element in it an id of its own.
        id: `column-${index}`,
        content: [
          {
            type: "Text",
            props: { id: `column-${index}-text`, text: `<p>${t("starter.columnText")}</p>` },
          },
        ],
      },
    })),
    layout: { $responsive: { desktop: "equal", mobile: "stacked" } },
    gap: "medium",
  },
  render: ({ values, slots }) => {
    const Columns = slots.columns;
    const layout: Responsive<ColumnLayout> = values.layout;
    const placing = responsiveClasses(layout, (value) => COLUMN_LAYOUT_CLASS[value]);
    const gap = responsiveClasses(values.gap, (value) => COLUMN_GAP_CLASS[value]);
    return (
      <div
        className={`site-columns${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        <ColumnsLayoutContext value={layout}>
          {/* The grid is the slot's own element, so the canvas lays them out as the export does. */}
          <Columns className={`grid ${placing} ${gap}`} />
        </ColumnsLayoutContext>
      </div>
    );
  },
});

/** One column of a Columns element: elements one under another. */
const column = defineComponent({
  label: t("element.column"),
  place: "child",
  fields: {
    content: { kind: "slot", label: t("field.content"), accepts: "element" },
  },
  defaults: { content: [] },
  // Marked for the canvas's *Show column outlines* preview (2.17), which outlines its edges.
  render: ({ slots, context }) => {
    const Content = slots.content;
    return (
      <div
        className="site-column min-w-0"
        {...(context.previews?.columnOutlines === true
          ? { [PREVIEW_ATTRIBUTE]: "column-outline" }
          : {})}
      >
        <Content className="flex flex-col gap-4" />
      </div>
    );
  },
});

const LIST_STYLES = ["bullets", "numbers", "plain"] as const;
/** A List's markers, and the space between its items. */
const LIST_CLASS = {
  bullets: "list-disc space-y-2 pl-6",
  numbers: "list-decimal space-y-2 pl-6",
  plain: "list-none space-y-2",
} as const;

/** The icon a List shows before each item instead of its markers (F-ED-22); none for markers. */
const ListIconContext = createContext<string | undefined>(undefined);

/** A List item's row: its List's icon, if it has one, then its text. */
function ListItemRow({ text }: { readonly text: ReactNode }) {
  const icon = useContext(ListIconContext);
  if (icon === undefined) return <li className="site-list-item">{text}</li>;
  return (
    <li className="site-list-item flex items-start gap-2">
      <LucideIcon name={icon} className="mt-[0.3em] size-[1em] shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}

/** A list of short texts: bullets, numbers, an icon or none, each item edited on the canvas. */
const list = defineComponent({
  label: t("element.list"),
  category: t("category.text"),
  fields: {
    items: { kind: "slot", label: t("field.listItems"), allow: ["ListItem"] },
    style: {
      kind: "select",
      label: t("field.listStyle"),
      options: LIST_STYLES.map((value) => ({ label: t(`field.listStyle.${value}`), value })),
      // An icon takes the markers' place, so no style would change anything. A name Lucide doesn't
      // have draws no icon, as the List reads it, so the style still counts then.
      unavailable: (values) =>
        isIconName(values.icon) ? t("field.listStyle.unavailable") : undefined,
    },
    // Before each item instead of its markers (F-ED-22).
    icon: { kind: "icon", label: t("field.listIcon"), help: t("field.listIcon.help") },
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  behaviours: entranceBehaviours,
  defaults: {
    items: [0, 1, 2].map((index) => ({
      type: "ListItem",
      props: { id: `list-item-${index}`, text: t("starter.listItem") },
    })),
    style: "bullets",
  },
  render: ({ values, slots }) => {
    const Items = slots.items;
    // An icon replaces the markers: a plain list with it before each item.
    const style = values.icon === undefined ? values.style : "plain";
    const className = `site-list ${BODY_TEXT_CLASSES} ${LIST_CLASS[style]}${marginClasses(values.margin)}${entranceClasses(values)}`;
    const entrance = entranceAttributes(values);
    // Without a class the slot adds no element, so its items are the list's own <li>s.
    return (
      <ListIconContext value={values.icon}>
        {style === "numbers" ? (
          <ol className={className} {...entrance}>
            <Items />
          </ol>
        ) : (
          // Safari and VoiceOver drop a list's semantics once its markers are gone: say it is one.
          <ul className={className} role={style === "plain" ? "list" : undefined} {...entrance}>
            <Items />
          </ul>
        )}
      </ListIconContext>
    );
  },
});

/** One item of a List. */
const listItem = defineComponent({
  label: t("element.listItem"),
  place: "child",
  fields: {
    text: { kind: "text", label: t("field.text"), inline: true },
  },
  defaults: { text: t("starter.listItem") },
  render: ({ values }) => <ListItemRow text={values.text} />,
});

const ICON_SIZES = ["small", "medium", "large", "xlarge"] as const;
const ICON_SIZE_CLASS = {
  small: "size-6",
  medium: "size-8",
  large: "size-12",
  xlarge: "size-16",
} as const;
const ICON_COLOURS = ["default", "primary", "secondary", "accent"] as const;

/**
 * One of Lucide's icons on its own (F-ED-22), drawn as inline SVG. Decorative unless it has a
 * label, which names it for screen readers ("Phone").
 */
const icon = defineComponent({
  label: t("element.icon"),
  category: t("category.basic"),
  fields: {
    icon: { kind: "icon", label: t("field.icon") },
    label: { kind: "text", label: t("field.iconLabel"), help: t("field.iconLabel.help") },
    size: {
      kind: "slider",
      label: t("field.size"),
      responsive: true,
      steps: ICON_SIZES.map((value) => ({ label: t(`field.iconSize.${value}`), value })),
    },
    color: {
      kind: "color",
      label: t("field.color"),
      options: ICON_COLOURS.map((value) => ({ label: t(`field.color.${value}`), value })),
    },
    alignment: ALIGNMENT_FIELD,
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: { icon: "star", label: "", size: "medium", color: "primary", alignment: "left" },
  behaviours: entranceBehaviours,
  render: ({ values }) => {
    const size = responsiveClasses(values.size, (value) => ICON_SIZE_CLASS[value]);
    const colour = colorClass("text", values.color);
    return (
      <div
        className={`site-icon flex ${BUTTON_ALIGN_CLASS[values.alignment]}${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        {values.icon === undefined ? null : (
          <LucideIcon
            name={values.icon}
            className={colour === "" ? size : `${size} ${colour}`}
            label={values.label}
          />
        )}
      </div>
    );
  },
});

const SOCIAL_SIZES = ["small", "medium", "large"] as const;
const SOCIAL_SIZE_CLASS = { small: "size-5", medium: "size-6", large: "size-8" } as const;

/**
 * Links to the site's pages on social networks, each by its logo (PH2-4), from Site Settings →
 * Social & sharing: a profile added there shows on every page at once. Nothing in the export
 * without any.
 */
const socialLinks = defineComponent({
  label: t("element.socialLinks"),
  category: t("category.basic"),
  fields: {
    size: {
      kind: "slider",
      label: t("field.size"),
      steps: SOCIAL_SIZES.map((value) => ({ label: t(`field.iconSize.${value}`), value })),
    },
    color: {
      kind: "color",
      label: t("field.color"),
      help: t("field.socialColor.help"),
      options: ICON_COLOURS.map((value) => ({ label: t(`field.color.${value}`), value })),
    },
    alignment: ALIGNMENT_FIELD,
    margin: MARGIN_FIELD,
  },
  defaults: { size: "medium", color: "default", alignment: "left" },
  render: ({ values, context }) => {
    const profiles = context.socialProfiles ?? [];
    const className = `site-social flex flex-wrap gap-3 ${BUTTON_ALIGN_CLASS[values.alignment]}${marginClasses(values.margin)}`;
    if (profiles.length === 0) {
      const hint = context.socialHint?.();
      return hint === undefined ? null : <div className={className}>{hint}</div>;
    }
    const logo = `${SOCIAL_SIZE_CLASS[values.size]} ${colorClass("text", values.color)}`.trim();
    return (
      // biome-ignore lint/a11y/noRedundantRoles: Safari and VoiceOver drop a list's semantics without markers.
      <ul className={`${className} m-0 list-none p-0`} role="list">
        {profiles.map((profile, index) => {
          const name = socialName(profile);
          return (
            // Profiles have no ids, and render in the order Site Settings keep them.
            <li key={index}>
              {/* rel="me": the page is the site's own profile there (Mastodon verifies it). */}
              <a href={profile.url} rel="me" aria-label={name} title={name}>
                <SocialLogo network={profile.network} className={logo} />
              </a>
            </li>
          );
        })}
      </ul>
    );
  },
});

/** The basic elements (2.9): Image, Button, Spacer, Divider, Columns, List, Icon and Social links. */
export const elementsComponents: Readonly<Record<string, ComponentDef>> = {
  Image: image,
  Button: button,
  Spacer: spacer,
  Divider: divider,
  Columns: columns,
  Column: column,
  List: list,
  ListItem: listItem,
  Icon: icon,
  SocialLinks: socialLinks,
};
