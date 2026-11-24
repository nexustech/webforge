import { type FieldRendererProps, type FieldSpec, MultiChoiceField } from "@webforge/editor-ui";
import { type SiteDoc, sameJson } from "@webforge/model";
import type { NavLink } from "@webforge/site-components";
import type { EditorSession } from "../../editor/editor-session.js";
import { canvasNavigation, canvasPageLinks } from "../../editor/site-navigation.js";
import { useDocument } from "../../editor/use-document.js";

/** A page a pages field offers: its id, and its name as the menu shows it. */
type PageChoice = { readonly value: string; readonly label: string };

/**
 * The pages a pages field offers (HF-8): the pages the menu shows, as it names them (`menu`),
 * every other page (`others`), or every page (`all`, HF-5), in Pages panel order. "Page not found"
 * and a Blog's posts never are.
 */
export function pageChoices(site: SiteDoc, from: FieldSpec<"pages">["from"]): PageChoice[] {
  const menu = (canvasNavigation(site, site.homePageId) ?? []).flatMap((item) =>
    "children" in item ? item.children : [item],
  );
  const choice = (link: NavLink): PageChoice[] =>
    link.pageId === undefined ? [] : [{ value: link.pageId, label: link.label }];
  const inMenu = menu.flatMap(choice);
  // A page linked twice, from a dropdown and the bar, is one choice.
  const unique = inMenu.filter(
    (each, index) => inMenu.findIndex((other) => other.value === each.value) === index,
  );
  if (from === "menu") return unique;
  const every = (canvasPageLinks(site, site.homePageId) ?? []).flatMap(choice);
  if (from === "all") return every;
  const shown = new Set(unique.map((each) => each.value));
  return every.filter((each) => !shown.has(each.value));
}

/**
 * The Edit panel's pages field (HF-8): a checkbox for each page it offers, the menu's to leave out
 * of the Footer's Menu links or the others to add to them, the ticked ones its value.
 */
export function PagesField({
  session,
  field,
  ...props
}: FieldRendererProps<"pages"> & { readonly session: Pick<EditorSession, "history"> }) {
  const options = useDocument(session, (site) => pageChoices(site, field.from), sameJson);
  return (
    <MultiChoiceField {...props} field={{ kind: "multiChoice", label: field.label, options }} />
  );
}
