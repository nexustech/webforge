import { t } from "@webforge/i18n";
import { boundText, type ComponentDef } from "../library.js";

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

/**
 * The shared Header (C5): site name and navigation. On small screens the navigation folds into a
 * menu opened by a button (`webforge.js` "menu" behaviour sets `data-open` and `aria-expanded`).
 */
export const header: ComponentDef = {
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
        <nav aria-label={t("siteText.navigation")}>
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
            {context.navigation.map((link) => (
              <li key={link.href}>
                <a href={link.href} aria-current={link.current ? "page" : undefined}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    );
  },
};

/** The shared Footer (C5). */
export const footer: ComponentDef = {
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
};
