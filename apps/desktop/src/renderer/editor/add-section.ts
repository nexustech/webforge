import type { InsertPoint } from "@webforge/engine";
import { newId } from "@webforge/model";
import { currentPage, type EditorSession } from "./editor-session.js";
import { labelFor } from "./labels.js";

/** What the floating + adds until the Add panel (1.13) opens at the insertion point instead. */
const SECTION_TYPE = "Section";

/**
 * Adds an empty Section to the shown page at `at`, as one "Added Section" step that selects it.
 * Does nothing if the library has no Section.
 */
export function addSection(session: EditorSession, at: InsertPoint): void {
  const definition = session.library.components[SECTION_TYPE];
  if (definition === undefined) {
    return;
  }
  const { pageId, viewport } = session.ui.getState();
  const page = currentPage(session)?.doc;
  if (page === undefined) {
    return;
  }
  const id = newId("node");
  const label = labelFor(
    { kind: "insert", nodeId: id, componentType: SECTION_TYPE, field: null, page, selection: id },
    session.library,
  );
  session.edit(
    "insert",
    label,
    (draft) => {
      const page = draft.pages[pageId];
      if (page !== undefined) {
        const content = page.doc.content;
        content.splice(Math.min(at.index, content.length), 0, {
          type: SECTION_TYPE,
          props: { ...structuredClone(definition.defaults), id },
        });
      }
    },
    { selectionAfter: { pageId, viewport, nodeId: id } },
  );
  session.ui.setState({ nodeId: id });
}
