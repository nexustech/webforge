import type { NodeDoc } from "@webforge/model";
import { appearanceClassGroups, type ComponentDef, withLook } from "@webforge/site-components";
import type { EditorSession } from "./editor-session.js";
import { type ItemCssServices, ItemCssView } from "./ItemCssView.js";
import { useDocument } from "./use-document.js";

/**
 * The CSS tab for `node` (3.14): its classes grouped by the Appearance control that set them, from
 * its own values with its kind's look in the theme under them (3.12), as it renders; each named as
 * `component`'s Style tab names it.
 */
export function ItemCss({
  session,
  node,
  component,
  services,
}: {
  readonly session: Pick<EditorSession, "history" | "ui">;
  readonly node: NodeDoc;
  readonly component: ComponentDef;
  readonly services: ItemCssServices;
}) {
  const looks = useDocument(session, (site) => site.theme.looks);
  const groups = appearanceClassGroups(withLook(node.props, node.type, looks)).map((group) => ({
    ...group,
    fromLook: node.props[group.field] === undefined,
  }));
  return (
    <ItemCssView
      session={session}
      {...services}
      groups={groups}
      labelOf={(field) => component.fields[field]?.label ?? field}
    />
  );
}
