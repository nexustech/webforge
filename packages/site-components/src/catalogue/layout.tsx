import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { isDocumentPath } from "../document-path.js";
import { boundText, type ComponentDef } from "../library.js";
import type { NavLink, RenderContext } from "../schema.js";

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

/** A small down arrow for a dropdown's button, drawn inline (C8). */
function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** One link of the navigation: a button ("Book now") or a plain link, in a new tab if set. */
function NavLinkItem({ link }: { readonly link: NavLink }) {
  return (
    <li>
      <a
        href={link.href}
        aria-current={link.current ? "page" : undefined}
        className={link.button === true ? "btn btn-primary btn-sm md:ml-2" : undefined}
        {...(link.newTab === true ? { target: "_blank", rel: "noopener" } : {})}
        {...(link.download === true && isDocumentPath(link.href) ? { download: "" } : {})}
      >
        {link.label}
      </a>
    </li>
  );
}

/**
 * The navigation's items (F-ED-17): links, buttons and dropdowns. A dropdown's button opens its
 * list (`webforge.js` "menu" behaviour sets `aria-expanded` and `data-open`); until the script has
 * run, or without it, the list shows while the dropdown has the focus.
 */
function NavItems({ id, context }: { readonly id: string; readonly context: RenderContext }) {
  return (
    <>
      {context.navigation.map((item, index) => {
        if (!("children" in item)) {
          return <NavLinkItem key={item.id ?? `${index}:${item.href}`} link={item} />;
        }
        const listId = `${id}-${index}`;
        return (
          <li
            key={item.id ?? listId}
            className="site-submenu relative [&:not([data-wf-ready]):focus-within>ul]:block"
          >
            <button
              type="button"
              aria-expanded="false"
              aria-controls={listId}
              data-wf-submenu-toggle=""
            >
              {item.label}
              <ChevronIcon />
            </button>
            <ul
              id={listId}
              className="hidden data-open:block md:absolute md:top-full md:z-20 md:mt-1 md:w-48 md:rounded-box md:bg-base-100 md:p-2 md:shadow"
            >
              {item.children.map((link, childIndex) => (
                <NavLinkItem key={link.id ?? `${childIndex}:${link.href}`} link={link} />
              ))}
            </ul>
          </li>
        );
      })}
    </>
  );
}

/**
 * The shared Header (C5): site name and navigation, from the site's menu (F-ED-17). On small
 * screens the navigation folds into a menu opened by a button (`webforge.js` "menu" behaviour sets
 * `data-open` and `aria-expanded`).
 */
const header = defineComponent({
  label: t("layout.header"),
  place: "layout",
  fields: {
    siteName: {
      kind: "text",
      label: t("field.siteName"),
      inline: true,
      bindable: ["general.name", "contact.businessName"],
    },
  },
  defaults: { siteName: t("site.untitledName") },
  behaviours: ["menu"],
  render: ({ id, values, context }) => {
    const menuId = `${id}-menu`;
    return (
      <header className="site-header navbar relative bg-base-100 px-4 shadow-sm">
        <div className="flex-1">
          <a className="text-xl font-bold" href={context.link("index")}>
            {boundText(values, "siteName", context)}
          </a>
        </div>
        {/* Until webforge.js has run, or without it, the menu shows while the nav has the focus. */}
        <nav
          aria-label={t("siteText.navigation")}
          className="[&:not([data-wf-ready]):focus-within>ul]:flex"
        >
          <button
            type="button"
            className="btn btn-square btn-ghost md:hidden"
            aria-expanded="false"
            aria-controls={menuId}
            data-wf-menu-toggle=""
          >
            <MenuIcon />
            <span className="sr-only">{t("siteText.menu")}</span>
          </button>
          <ul
            id={menuId}
            className="menu absolute inset-x-0 top-full z-10 hidden w-full bg-base-100 p-2 shadow data-open:flex md:static md:flex md:w-auto md:menu-horizontal md:p-0 md:shadow-none"
          >
            <NavItems id={menuId} context={context} />
          </ul>
        </nav>
      </header>
    );
  },
});

/** The shared Footer (C5). */
const footer = defineComponent({
  label: t("layout.footer"),
  place: "layout",
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
    return (
      <footer className="site-footer footer footer-center bg-base-200 p-8 text-base-content">
        {content === null ? null : <p>{content}</p>}
      </footer>
    );
  },
});

/** The shared Header and Footer (C5), on every page and never added to one. */
export const layoutComponents: Readonly<Record<string, ComponentDef>> = {
  Header: header,
  Footer: footer,
};
