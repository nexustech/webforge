import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { isDocumentPath } from "../document-path.js";
import { boundText, type ComponentDef } from "../library.js";
import { PREVIEW_ATTRIBUTE } from "../previews.js";
import type { NavItem, NavLink } from "../schema.js";
import { BUTTON_CLASSES } from "../typography.js";

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
              <summary>{item.label}</summary>
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
 * {@link NavItems}, so they hold the same links (the split layout's button aside, which is drawn
 * beside the row); a test checks they can't drift apart.
 */
function HeaderNavigation({
  items,
  menuItems,
  menuOpen,
  className,
}: {
  /** The items in the row on wide screens. */
  readonly items: readonly NavItem[];
  /** The items in the menu on small screens. */
  readonly menuItems: readonly NavItem[];
  /** Shows the small screens' menu open: the canvas's *Show mobile menu* preview (UX-26). */
  readonly menuOpen: boolean;
  readonly className?: string;
}) {
  return (
    <nav aria-label={t("siteText.navigation")} className={className}>
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
          <span className="sr-only">{t("siteText.menu")}</span>
        </summary>
        <ul className="menu absolute inset-x-0 top-full z-10 w-full bg-base-100 p-2 shadow">
          <NavItems items={menuItems} />
        </ul>
      </details>
    </nav>
  );
}

const HEADER_LAYOUTS = ["left", "centred", "split"] as const;
const SCROLL_STYLES = ["shadow", "shrink", "solid", "none"] as const;

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
 * The shared Header (C5): the site name and the navigation, from the site's menu (F-ED-17), in one
 * of three layouts: the name left and the menu right, everything centred with the menu below, or
 * split with the menu's last link as a button on the right (2.6). It can stay at the top while the
 * page scrolls, changing its style once it has (F-DS-6).
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
    },
    sticky: { kind: "toggle", label: t("field.sticky") },
    scrollStyle: {
      kind: "select",
      label: t("field.scrollStyle"),
      options: SCROLL_STYLES.map((value) => ({ label: t(`field.scrollStyle.${value}`), value })),
    },
  },
  defaults: { siteName: t("site.untitledName"), sticky: false, scrollStyle: "shadow" },
  behaviours: (values) => (values.sticky ? ["menu", "sticky"] : ["menu"]),
  render: ({ values, context }) => {
    const layout = values.variant;
    const items = context.navigation;
    // Split: the menu's last link becomes the button on the right on wide screens.
    const last = items.at(-1);
    const button = layout === "split" && last !== undefined && !("children" in last) ? last : null;
    const row = button === null ? items : items.slice(0, -1);
    const look = values.sticky
      ? `${STICKY_CLASSES[values.scrollStyle]} ${STICKY_OFFSET[layout]}`
      : "bg-base-100 shadow-sm";
    const name = (
      <a className="font-heading text-xl font-bold" href={context.link("index")}>
        {boundText(values, "siteName", context)}
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
          items={row}
          menuItems={items}
          menuOpen={context.previews?.mobileMenu === true}
          {...(layout === "left" ? {} : { className: "md:flex md:flex-1 md:justify-center" })}
        />
        {button === null ? null : (
          <NavAnchor link={button} className={`${BUTTON_CLASSES.primary} hidden md:inline-flex`} />
        )}
      </header>
    );
  },
});

const FOOTER_LAYOUTS = ["centred", "columns"] as const;

/** The links of the site's menu, dropdowns' too, for the Footer's columns. */
const linksOf = (items: readonly NavItem[]): NavLink[] =>
  items.flatMap((item) => ("children" in item ? item.children : [item]));

/**
 * *Cookie settings* in the Footer of a site with Google Analytics and its consent banner (#539,
 * B7): the `consent` behaviour shows it and reopens the banner with it, so a visitor can change
 * their choice as easily as they made it. Hidden as written: without the script there is no banner
 * to reopen, and nothing is counted.
 */
function CookieSettings() {
  return (
    <button type="button" className="link link-hover" data-wf-consent-open="" hidden>
      {t("siteText.consent.settings")}
    </button>
  );
}

/**
 * The shared Footer (C5), in one of two layouts (2.6): its text centred, or in columns with the
 * site's menu as links beside it.
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
  },
  defaults: { text: t("starter.footer") },
  render: ({ values, context }) => {
    const content = boundText(values, "text", context);
    const text = content === null ? null : <p>{content}</p>;
    const cookies = context.cookieSettings === true ? <CookieSettings /> : null;
    if (values.variant === "centred") {
      return (
        <footer className="site-footer footer footer-center bg-base-200 p-8 text-base-content">
          {text}
          {cookies}
        </footer>
      );
    }
    const links = linksOf(context.navigation);
    return (
      <footer className="site-footer footer sm:footer-horizontal bg-base-200 p-8 text-base-content">
        <aside>
          {text}
          {cookies}
        </aside>
        {links.length === 0 ? null : (
          <nav aria-label={t("siteText.footerNavigation")} className="flex flex-col gap-2">
            {links.map((link, index) => (
              <NavAnchor
                key={link.id ?? `${index}:${link.href}`}
                link={link}
                className="link link-hover"
              />
            ))}
          </nav>
        )}
      </footer>
    );
  },
});

/** The shared Header and Footer (C5), on every page and never added to one. */
export const layoutComponents: Readonly<Record<string, ComponentDef>> = {
  Header: header,
  Footer: footer,
};
