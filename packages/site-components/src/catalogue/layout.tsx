import { t } from "@webforge/i18n/components";
import type { SiteText } from "@webforge/i18n/site-text";
import { hasLink, isNodeDoc, type NodeDoc } from "@webforge/model";
import type { ReactNode } from "react";
import { FooterColumnContext } from "../column-form.js";
import { defineComponent } from "../define.js";
import { isDocumentPath } from "../document-path.js";
import { boundString, boundText, type ComponentDef } from "../library.js";
import { Picture } from "../picture.js";
import { PREVIEW_ATTRIBUTE } from "../previews.js";
import type { NavItem, NavLink, RenderContext } from "../schema.js";
import { BUTTON_CLASSES, ButtonLink } from "../typography.js";

/** Three-line menu icon, drawn inline so the site needs no icon font (C8). */
function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** A link of the site's menu: marked if it's the page you're on, in a new tab or a download if set. */
function NavAnchor({ link, className }: { readonly link: NavLink; readonly className?: string }) {
  return (
    <a
      href={link.href}
      aria-current={link.current ? "page" : undefined}
      className={className}
      {...(link.newTab === true ? { target: "_blank", rel: "noopener" } : {})}
      {...(link.download === true && isDocumentPath(link.href) ? { download: "" } : {})}
    >
      {link.label}
    </a>
  );
}

/** One link of the navigation: a button ("Book now") or a plain link. */
function NavLinkItem({ link }: { readonly link: NavLink }) {
  return (
    <li>
      <NavAnchor
        link={link}
        {...(link.button === true ? { className: `${BUTTON_CLASSES.primarySmall} md:ml-2` } : {})}
      />
    </li>
  );
}

/**
 * A dropdown's own item while one of its links is current: the current page's, or the section in
 * view's (5.10), in the menu's active colours, as daisyUI draws a current link.
 */
const CURRENT_DROPDOWN_CLASSES =
  "[details:has([aria-current])>&]:bg-(--menu-active-bg) [details:has([aria-current])>&]:text-(--menu-active-fg)";

/**
 * The navigation's items (F-ED-17): links, buttons and dropdowns. A dropdown is a `<details>`,
 * which its `<summary>` opens without the script too; `webforge.js`'s "menu" behaviour keeps one
 * open at a time and closes it with Escape, a click outside or focus moving on.
 */
function NavItems({ items }: { readonly items: readonly NavItem[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (!("children" in item)) {
          return <NavLinkItem key={item.id ?? `${index}:${item.href}`} link={item} />;
        }
        return (
          <li key={item.id ?? `${index}:${item.label}`}>
            <details className="site-submenu" data-wf-dropdown="">
              <summary className={CURRENT_DROPDOWN_CLASSES}>{item.label}</summary>
              <ul className="md:z-20 md:w-48">
                {item.children.map((link, childIndex) => (
                  <NavLinkItem key={link.id ?? `${childIndex}:${link.href}`} link={link} />
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </>
  );
}

/**
 * The Header's navigation: its items in a row on wide screens; on small ones, a menu that its
 * button opens. The menu is a `<details>`, so it opens and closes without the script too, with a
 * tap on iOS, and is announced as expanded or collapsed (2.6); `webforge.js`'s "menu" behaviour
 * closes it with Escape, a click outside or a chosen link.
 *
 * The site's menu is drawn twice, once for each screen size: a closed `<details>` hides what it
 * holds, which CSS can't show again on wide screens. Both lists come from the same items through
 * {@link NavItems}, so they hold the same links; the Header's own button (HF-2) is drawn beside
 * the row, and last in the menu. A test checks they can't drift apart.
 */
function HeaderNavigation({
  items,
  menuButton,
  menuOpen,
  className,
  siteText,
}: {
  /** The menu's items: in the row on wide screens, and in the menu on small ones. */
  readonly items: readonly NavItem[];
  /** The Header's own button, last in the small screens' menu (HF-2). */
  readonly menuButton?: ReactNode;
  /** Shows the small screens' menu open: the canvas's *Show mobile menu* preview (UX-26). */
  readonly menuOpen: boolean;
  readonly className?: string;
  readonly siteText: SiteText;
}) {
  return (
    <nav aria-label={siteText("siteText.navigation")} className={className}>
      <ul className="menu menu-horizontal hidden p-0 md:flex">
        <NavItems items={items} />
      </ul>
      <details
        className="site-menu md:hidden"
        data-wf-menu=""
        {...(menuOpen ? { open: true, [PREVIEW_ATTRIBUTE]: "mobile-menu" } : {})}
      >
        <summary className={`${BUTTON_CLASSES.menu} list-none [&::-webkit-details-marker]:hidden`}>
          <MenuIcon />
          <span className="sr-only">{siteText("siteText.menu")}</span>
        </summary>
        <ul className="menu absolute inset-x-0 top-full z-10 w-full bg-base-100 p-2 shadow">
          <NavItems items={items} />
          {menuButton}
        </ul>
      </details>
    </nav>
  );
}

const HEADER_LAYOUTS = ["left", "centred", "split"] as const;
const SCROLL_STYLES = ["shadow", "shrink", "solid", "none"] as const;
const LOGO_PLACES = ["instead", "beside"] as const;
const LOGO_SIZES = ["small", "medium", "large"] as const;

/**
 * The logo's height at each size (HF-1): on phones never above the menu's button, so the Header
 * stays one line high there.
 */
const LOGO_HEIGHTS: Readonly<Record<(typeof LOGO_SIZES)[number], string>> = {
  small: "h-8",
  medium: "h-10 md:h-12",
  large: "h-10 md:h-16",
};

/**
 * A sticky header's classes for its scroll style (F-DS-6), applied once the page has scrolled 80 px
 * (`data-scrolled`, set by `webforge.js`'s "sticky" behaviour).
 */
const STICKY_CLASSES: Readonly<Record<(typeof SCROLL_STYLES)[number], string>> = {
  shadow: "sticky top-0 bg-base-100 shadow-none transition-shadow data-scrolled:shadow-md",
  shrink:
    "sticky top-0 bg-base-100 shadow-sm transition-[min-height,padding] data-scrolled:min-h-12 data-scrolled:py-1",
  solid:
    "sticky top-0 bg-base-100/80 shadow-sm backdrop-blur transition-colors data-scrolled:bg-base-100",
  none: "sticky top-0 bg-base-100 shadow-sm",
};

/**
 * The scroll padding a sticky header gives the page, so anchor targets aren't hidden under it
 * without the script either: at least its height in each layout (the script then follows its real
 * height). The centred layout is taller on wide screens, its menu below the name.
 */
const STICKY_OFFSET: Readonly<Record<(typeof HEADER_LAYOUTS)[number], string>> = {
  left: "[:root:has(&)]:scroll-pt-20",
  centred: "[:root:has(&)]:scroll-pt-20 md:[:root:has(&)]:scroll-pt-32",
  split: "[:root:has(&)]:scroll-pt-20",
};

/** Each layout's own classes: where the site name, the navigation and the button go. */
const HEADER_CLASSES: Readonly<Record<(typeof HEADER_LAYOUTS)[number], string>> = {
  left: "navbar gap-2 px-4",
  centred: "flex items-center justify-between gap-2 px-4 py-3 md:flex-col md:justify-center",
  split: "navbar gap-2 px-4",
};

/**
 * The shared Header (C5): the site name or its logo (HF-1), and the navigation, from the site's
 * menu (F-ED-17), in one of three layouts: the name left and the menu right, everything centred
 * with the menu below, or split with the menu's last link as a button on the right (2.6). It can
 * stay at the top while the page scrolls, changing its style once it has (F-DS-6).
 */
const header = defineComponent({
  label: t("layout.header"),
  place: "layout",
  variants: HEADER_LAYOUTS.map((value) => ({ label: t(`field.headerLayout.${value}`), value })),
  fields: {
    siteName: {
      kind: "text",
      label: t("field.siteName"),
      inline: true,
      bindable: ["general.name", "contact.businessName"],
      help: t("field.siteName.help"),
    },
    // The logo in Site Settings (HF-1, 5.37): offered once the site has one.
    logoPlace: {
      kind: "select",
      label: t("field.logoPlace"),
      options: LOGO_PLACES.map((value) => ({ label: t(`field.logoPlace.${value}`), value })),
      shownWhen: (_values, site) => site.hasLogo === true,
    },
    logoSize: {
      kind: "select",
      label: t("field.logoSize"),
      options: LOGO_SIZES.map((value) => ({ label: t(`field.logoSize.${value}`), value })),
      shownWhen: (_values, site) => site.hasLogo === true,
    },
    // The Header's own button (HF-2, 5.38), in any layout.
    button: { kind: "toggle", label: t("field.headerButton"), help: t("field.headerButton.help") },
    buttonLabel: {
      kind: "text",
      label: t("field.buttonLabel"),
      shownWhen: (values) => values.button === true,
    },
    buttonLink: {
      kind: "link",
      label: t("field.buttonLink"),
      button: "buttonLabel",
      shownWhen: (values) => values.button === true,
    },
    sticky: { kind: "toggle", label: t("field.sticky") },
    scrollStyle: {
      kind: "select",
      label: t("field.scrollStyle"),
      options: SCROLL_STYLES.map((value) => ({ label: t(`field.scrollStyle.${value}`), value })),
    },
    // The section in view (5.10b, GA10-1): the export leaves "section-spy" out when it's off
    // (`highlightsSectionInView`). Offered only while the menu links to a section.
    sectionHighlight: {
      kind: "toggle",
      label: t("field.sectionHighlight"),
      help: t("field.sectionHighlight.help"),
      shownWhen: (_values, site) => site.menuLinksToSections,
    },
  },
  defaults: {
    siteName: t("site.untitledName"),
    logoPlace: "instead",
    logoSize: "medium",
    button: false,
    buttonLabel: t("starter.headerButton"),
    sticky: false,
    scrollStyle: "shadow",
    sectionHighlight: true,
  },
  behaviours: (values) => (values.sticky ? ["menu", "sticky"] : ["menu"]),
  render: ({ values, context }) => {
    const layout = values.variant;
    const items = context.navigation;
    const { button, menuButton } = headerButton(values, context);
    const look = values.sticky
      ? `${STICKY_CLASSES[values.scrollStyle]} ${STICKY_OFFSET[layout]}`
      : "bg-base-100 shadow-sm";
    // The logo in Site Settings (HF-1), in place of the name or beside it; the name, while there's
    // no logo or its picture is gone from Media.
    const logo = context.logo === undefined ? null : context.image(context.logo);
    const beside = values.logoPlace === "beside";
    const named = boundString(values, "siteName", context).trim();
    const name = (
      <a
        className={`font-heading text-xl font-bold${logo === null ? "" : " flex items-center gap-2"}`}
        href={context.link("index")}
      >
        {logo === null ? null : (
          <Picture
            image={logo}
            // In its place, the logo is the name; beside it, the name says it already.
            alt={beside ? "" : named || context.siteText("siteText.logo")}
            sizes="320px"
            inView
            className={`${LOGO_HEIGHTS[values.logoSize]} w-auto max-w-48 object-contain md:max-w-64`}
          />
        )}
        {logo === null || beside ? boundText(values, "siteName", context) : null}
      </a>
    );
    return (
      <header
        className={`site-header relative z-30 ${HEADER_CLASSES[layout]} ${look}`}
        {...(values.sticky ? { "data-wf-sticky": "" } : {})}
      >
        {layout === "centred" ? (
          name
        ) : layout === "split" ? (
          <div className="flex-1 md:flex-none">{name}</div>
        ) : (
          <div className="flex-1">{name}</div>
        )}
        <HeaderNavigation
          items={items}
          menuButton={menuButton}
          menuOpen={context.previews?.mobileMenu === true}
          siteText={context.siteText}
          {...(layout === "left" ? {} : { className: "md:flex md:flex-1 md:justify-center" })}
        />
        {button}
      </header>
    );
  },
});

/**
 * The Header's own button (HF-2): on the right on wide screens, and last in the phone menu. Without
 * its link the canvas greys it out with its hint, and the export leaves it out.
 */
function headerButton(
  values: { readonly button: boolean; readonly buttonLabel: string; readonly buttonLink: unknown },
  context: RenderContext,
): { button: ReactNode; menuButton: ReactNode } {
  const label = values.buttonLabel.trim();
  if (!values.button || label === "") return { button: null, menuButton: null };
  const button = (
    <ButtonLink
      label={label}
      link={values.buttonLink}
      context={context}
      className="hidden md:inline-flex"
    />
  );
  if (!hasLink(values.buttonLink)) return { button, menuButton: null };
  return {
    button,
    menuButton: (
      <li>
        <ButtonLink label={label} link={values.buttonLink} context={context} kind="primarySmall" />
      </li>
    ),
  };
}

const FOOTER_LAYOUTS = ["centred", "columns"] as const;

/**
 * The most columns of elements a Footer has (HF-4, 5.39): three, beside its own text, which is the
 * first of four in *Columns*.
 */
export const MAX_FOOTER_COLUMNS = 3;

/**
 * What a Footer column takes (HF-4, 5.39): a title, text, a list, the site's social links, a
 * picture, the menu's links, and the business's contact details or a newsletter signup in their
 * column forms.
 */
export const FOOTER_COLUMN_TYPES = [
  "Heading",
  "Text",
  "List",
  "SocialLinks",
  "Image",
  "MenuLinks",
  "ContactDetails",
  "Newsletter",
] as const;

/** The links of the site's menu, dropdowns' too, for the Footer's columns. */
const linksOf = (items: readonly NavItem[]): NavLink[] =>
  items.flatMap((item) => ("children" in item ? item.children : [item]));

/**
 * *Cookie settings* in the Footer of a site with Google Analytics and its consent banner (#539,
 * B7): the `consent` behaviour shows it and reopens the banner with it, so a visitor can change
 * their choice as easily as they made it. Hidden as written: without the script there is no banner
 * to reopen, and nothing is counted.
 */
function CookieSettings({ siteText }: { readonly siteText: SiteText }) {
  return (
    <button type="button" className="link link-hover" data-wf-consent-open="" hidden>
      {siteText("siteText.consent.settings")}
    </button>
  );
}

/** What the Footer can start from (HF-4, 5.39): its text alone, the menu's links beside it, or both and more. */
export const FOOTER_PRESETS = ["simple", "columns", "full"] as const;
export type FooterPreset = (typeof FOOTER_PRESETS)[number];

/** A Footer column holding `content`, its id `id`. */
const presetColumn = (id: string, content: readonly NodeDoc[]): NodeDoc => ({
  type: "FooterColumn",
  props: { id, content: [...content] },
});

/**
 * What *Start from* gives the Footer (HF-4, 5.39): its layout and its columns, whose elements have
 * only what differs from their defaults (the editor adds those) and ids to make the site's own.
 * *Simple* is its text centred; *Columns* its text and the menu's links beside it, as today's two
 * layouts are; *Full* the menu's links under a title, the business's contact details, and its
 * social links over a newsletter signup.
 */
export function footerPreset(preset: FooterPreset): {
  readonly variant: (typeof FOOTER_LAYOUTS)[number];
  readonly columns: readonly NodeDoc[];
} {
  const menu: NodeDoc = { type: "MenuLinks", props: { id: "footer-menu" } };
  if (preset === "simple") return { variant: "centred", columns: [] };
  if (preset === "columns")
    return { variant: "columns", columns: [presetColumn("footer-links", [menu])] };
  return {
    variant: "columns",
    columns: [
      presetColumn("footer-links", [
        {
          type: "Heading",
          props: { id: "footer-links-title", text: t("starter.footerLinksTitle"), size: "small" },
        },
        menu,
      ]),
      presetColumn("footer-contact", [
        { type: "ContactDetails", props: { id: "footer-contact-details" } },
      ]),
      presetColumn("footer-follow", [
        { type: "SocialLinks", props: { id: "footer-social" } },
        { type: "Newsletter", props: { id: "footer-newsletter" } },
      ]),
    ],
  };
}

/**
 * The site menu's links, dropdowns' too, in a Footer column (HF-4, 5.39): they change with the
 * menu. A site with no menu leaves them out.
 */
const menuLinks = defineComponent({
  label: t("element.menuLinks"),
  place: "child",
  fields: {},
  defaults: {},
  render: ({ context }) => {
    const links = linksOf(context.navigation);
    if (links.length === 0) return null;
    return (
      <nav
        aria-label={context.siteText("siteText.footerNavigation")}
        className="flex flex-col gap-2"
      >
        {links.map((link, index) => (
          <NavAnchor
            key={link.id ?? `${index}:${link.href}`}
            link={link}
            className="link link-hover"
          />
        ))}
      </nav>
    );
  },
});

/**
 * Whether a column's slot value shows anything: on the canvas (a component) always, there to drop
 * into; in the export, a list with an element that isn't hidden, Menu links only with links to
 * show (a site with no menu draws none).
 */
const holdsShown = (slot: unknown, context: RenderContext): boolean =>
  typeof slot === "function" ||
  (Array.isArray(slot) &&
    slot.some(
      (node) =>
        isNodeDoc(node) &&
        node.props.hidden !== true &&
        (node.type !== "MenuLinks" || linksOf(context.navigation).length > 0),
    ));

/**
 * Whether element `id` among `nodes` is in a Footer column (5.39), where a section draws its
 * column form: Advanced mode's CSS tab draws it so too, as the export writes it.
 */
export function inFooterColumn(nodes: readonly NodeDoc[], id: string, inside = false): boolean {
  return nodes.some((node) => {
    if (node.props.id === id) return inside;
    const within = inside || node.type === "FooterColumn";
    return Object.values(node.props).some(
      (value) => Array.isArray(value) && inFooterColumn(value.filter(isNodeDoc), id, within),
    );
  });
}

/**
 * One column of the Footer (HF-4, 5.39): elements one under another. Contact details and a
 * Newsletter signup in it draw their column forms.
 */
const footerColumn = defineComponent({
  label: t("element.footerColumn"),
  place: "child",
  fields: {
    content: { kind: "slot", label: t("field.content"), allow: [...FOOTER_COLUMN_TYPES] },
  },
  defaults: { content: [] },
  render: ({ values, slots, context }) => {
    // The export leaves out a column with nothing shown in it, so it takes no room beside the
    // others. On the canvas the slot is a component, there to drop into.
    if (!holdsShown((values as Readonly<Record<string, unknown>>).content, context)) return null;
    const Content = slots.content;
    return (
      <div className="site-footer-column min-w-0">
        <FooterColumnContext value>
          <Content className="flex flex-col gap-3" />
        </FooterColumnContext>
      </div>
    );
  },
});

/**
 * The shared Footer (C5), in one of two layouts (2.6): its text centred, under its columns, or as
 * the first of its columns. Its columns hold elements (HF-4, 5.39), side by side on wider screens
 * and one under another on phones.
 */
const footer = defineComponent({
  label: t("layout.footer"),
  place: "layout",
  variants: FOOTER_LAYOUTS.map((value) => ({ label: t(`field.footerLayout.${value}`), value })),
  fields: {
    text: {
      kind: "text",
      label: t("field.text"),
      inline: true,
      bindable: [
        "contact.businessName",
        "contact.address",
        "contact.phone",
        "contact.email",
        "contact.openingHoursNote",
      ],
    },
    columns: {
      kind: "slot",
      label: t("field.footerColumns"),
      allow: ["FooterColumn"],
      max: MAX_FOOTER_COLUMNS,
      // One Menu links: two would write two "Footer navigation" landmarks.
      once: ["MenuLinks"],
    },
  },
  defaults: { text: t("starter.footer"), columns: [] },
  render: ({ values, slots, context }) => {
    const content = boundText(values, "text", context);
    const text = content === null ? null : <p>{content}</p>;
    const cookies =
      context.cookieSettings === true ? <CookieSettings siteText={context.siteText} /> : null;
    // The export leaves out the grid of a Footer with nothing shown in its columns, so a Footer of
    // its text alone is drawn as it was before columns. On the canvas the slot is a component,
    // there to show what it holds.
    const stored: unknown = (values as Readonly<Record<string, unknown>>).columns;
    const shown =
      typeof stored === "function" ||
      (Array.isArray(stored) &&
        stored.some(
          (column) =>
            isNodeDoc(column) &&
            column.props.hidden !== true &&
            holdsShown(column.props.content, context),
        ));
    const Columns = slots.columns;
    const columns = shown ? (
      <Columns className="site-footer-columns grid w-full gap-8 sm:grid-flow-col sm:auto-cols-fr" />
    ) : null;
    if (values.variant === "centred") {
      return (
        <footer className="site-footer footer footer-center bg-base-200 p-8 text-base-content">
          {columns}
          {text}
          {cookies}
        </footer>
      );
    }
    return (
      <footer className="site-footer footer sm:footer-horizontal bg-base-200 p-8 text-base-content">
        <aside>
          {text}
          {cookies}
        </aside>
        {columns}
      </footer>
    );
  },
});

/**
 * The shared Header and Footer (C5), on every page and never added to one, and what the Footer's
 * columns hold that nothing else does (5.39).
 */
export const layoutComponents: Readonly<Record<string, ComponentDef>> = {
  Header: header,
  Footer: footer,
  FooterColumn: footerColumn,
  MenuLinks: menuLinks,
};
