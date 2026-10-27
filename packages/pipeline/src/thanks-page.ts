import { t } from "@webforge/i18n";
import {
  type NodeDoc,
  type SitePage,
  type SiteSnapshot,
  THANKS_FIELD,
  THANKS_PATH,
} from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";

/** The elements that post to Site Settings' form service: a Newsletter posts to its own. */
const SERVICE_FORMS = new Set(["ContactForm", "Form"]);

const isNode = (value: unknown): value is NodeDoc =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string" &&
  typeof (value as { props?: unknown }).props === "object";

/** Whether `nodes`, or the elements in their slots, hold a form that isn't hidden. */
function holdsForm(nodes: readonly NodeDoc[]): boolean {
  return nodes.some(
    (node) =>
      node.props.hidden !== true &&
      (SERVICE_FORMS.has(node.type) ||
        Object.values(node.props).some(
          (value) => Array.isArray(value) && holdsForm(value.filter(isNode)),
        )),
  );
}

/** `escape`d for the Text element's HTML. */
const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** A node of `type` with its component's defaults and `props`. */
const node = (
  library: ComponentLibrary,
  type: string,
  props: Record<string, unknown>,
): NodeDoc => ({
  type,
  props: {
    ...structuredClone(library.components[type]?.defaults ?? {}),
    ...props,
  } as NodeDoc["props"],
});

/**
 * The thank-you page the export makes for a site without one (3.7, B3): a heading, a line saying
 * the message is on its way and a button back to the home page, with the site's Header and Footer,
 * out of the navigation.
 */
function madeThanksPage(site: SiteSnapshot, library: ComponentLibrary): SitePage {
  const home = site.pages.find((page) => page.path === "index");
  return {
    id: THANKS_PATH,
    path: THANKS_PATH,
    title: t("siteText.thanks.title"),
    hideFromNavigation: true,
    doc: {
      root: { props: {} },
      content: [
        node(library, "Section", {
          id: "thank-you",
          content: [
            node(library, "Heading", {
              id: "thank-you-heading",
              text: t("siteText.thanks.title"),
              size: "large",
            }),
            node(library, "Text", {
              id: "thank-you-text",
              text: `<p>${escapeHtml(t("siteText.thanks.text"))}</p>`,
            }),
            ...(home === undefined
              ? []
              : [
                  node(library, "Button", {
                    id: "thank-you-home",
                    label: t("siteText.thanks.home"),
                    link: { kind: "page", pageId: home.id },
                  }),
                ]),
          ],
        }),
      ],
    },
  };
}

/**
 * `site` with its thank-you page, and that page's address for the forms (3.7): when its form service
 * can send a visitor there after sending (`THANKS_FIELD`), a page holds a form that posts to it, and
 * Site Settings have the web address the service needs to make a whole address of. The site's own
 * page at `thank-you` is used if it has one; else the export makes one. Otherwise the site is as it
 * was, and the service shows its own thank-you page.
 */
export function withThanksPage(
  site: SiteSnapshot,
  library: ComponentLibrary,
): { readonly site: SiteSnapshot; readonly thanksPage?: string } {
  const address = site.settings?.["address.url"]?.trim().replace(/\/+$/, "") ?? "";
  const kind = site.formService?.kind;
  const redirects = kind !== undefined && THANKS_FIELD[kind] !== undefined;
  const forms = [
    site.layout.header,
    site.layout.footer,
    ...site.pages.map((page) => page.doc.content),
  ];
  if (!redirects || !address.startsWith("https://") || !forms.some(holdsForm)) return { site };
  const thanksPage = `${address}/${THANKS_PATH}.html`;
  if (site.pages.some((page) => page.path === THANKS_PATH)) return { site, thanksPage };
  return { site: { ...site, pages: [...site.pages, madeThanksPage(site, library)] }, thanksPage };
}
