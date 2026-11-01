import { sameJson } from "@webforge/model";
import type { EditorSession } from "./editor-session.js";
import { fieldTarget } from "./field-target.js";
import { breakpointOf, valueAt, withValueAt } from "./responsive-value.js";
import { useDocument, useUi } from "./use-document.js";

/**
 * Sets field `name` of element `nodeId` on the shown page to `value` (on the device viewed, for a
 * field that differs per device) as one undo step, written and named where the Edit panel writes
 * and names the same change: "Changed Heading size", "… on Mobile". The canvas toolbar's contextual
 * toolbars (SP-4) change fields through this. Nothing happens if the element or the field has gone,
 * or the field already has that value. `flush` ends a canvas text session first.
 */
export function changeField(
  session: EditorSession,
  flush: () => void,
  nodeId: string,
  name: string,
  value: unknown,
): void {
  flush();
  const { pageId, viewport } = session.ui.getState();
  const target = fieldTarget(session.history.document.getState(), session.library, pageId, nodeId);
  const field = target?.component.fields[name];
  if (target === undefined || field === undefined) return;
  const breakpoint = breakpointOf(viewport);
  const next = (stored: unknown) =>
    field.responsive === true ? withValueAt(stored, breakpoint, value) : value;
  const stored = target.storedOr(name, target.node.props[name]);
  if (sameJson(stored, next(stored))) return;
  session.edit("props", target.labelOf(name, field, breakpoint), target.recipe(name, next), {
    selectionAfter: { pageId, viewport, nodeId },
  });
}

/**
 * Field `name` of element `nodeId` on the shown page, as the Edit panel shows it: its default if it
 * was never set, and the device viewed's value for a field that differs per device. Undefined if
 * the element has gone. Redraws only when that value changes.
 */
export function useFieldValue(session: EditorSession, nodeId: string, name: string): unknown {
  const pageId = useUi(session, (ui) => ui.pageId);
  const breakpoint = useUi(session, (ui) => breakpointOf(ui.viewport));
  return useDocument(
    session,
    (site) => {
      const target = fieldTarget(site, session.library, pageId, nodeId);
      if (target === undefined) return undefined;
      const stored = target.storedOr(name, target.node.props[name]);
      return target.component.fields[name]?.responsive === true
        ? valueAt(stored, breakpoint)
        : stored;
    },
    sameJson,
  );
}
