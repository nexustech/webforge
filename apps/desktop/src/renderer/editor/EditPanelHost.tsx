import { EditPanel, type EditPanelField } from "@webforge/editor-ui";
import type { EngineEditKind } from "@webforge/engine";
import type { FieldDef } from "@webforge/site-components";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { applyPatch } from "./apply-patch.js";
import type { EditorSession } from "./editor-session.js";
import { labelFor } from "./labels.js";
import { findNode } from "./nodes.js";

/** The Edit panel's renderer kind for a field, or undefined for fields edited elsewhere. */
function rendererKind(field: FieldDef): string | undefined {
  switch (field.kind) {
    case "text":
    case "select":
    case "toggle":
    case "slider":
    case "color":
    case "spacing":
      return field.kind;
    // Rich text is edited on the canvas (1.23), images in their own field (1.16), slots by
    // dragging elements in.
    case "richtext":
    case "media":
    case "slot":
      return undefined;
  }
}

/** The tab a field goes on: its own `group`, else Style for choices and Content for the rest. */
function groupOf(field: FieldDef): "content" | "style" {
  return field.group ?? (field.kind === "select" ? "style" : "content");
}

/** Props of {@link EditPanelHost}. */
export type EditPanelHostProps = {
  readonly session: EditorSession;
  /** Ends a canvas text session before the panel changes the document. */
  readonly flush: () => void;
};

/**
 * The Edit panel for the element selected on the canvas (1.14). Every change is one labelled
 * history step ("Changed Heading size"); typing in a text field is one step per visit to the
 * field, merged as the user types and closed when they leave it.
 */
export function EditPanelHost({ session, flush }: EditPanelHostProps) {
  const { history, ui, library } = session;
  const site = useSyncExternalStore(history.document.subscribe, history.document.getState);
  const { pageId, nodeId, viewport } = useSyncExternalStore(ui.subscribe, ui.getState);
  const page = site.pages[pageId]?.doc;
  const node =
    page === undefined || nodeId === null
      ? undefined
      : findNode(page.content, (candidate) => candidate.props.id === nodeId);
  const component = node === undefined ? undefined : library.components[node.type];
  const selectedId = node?.props.id;

  // The text field being typed in: its run of edits ends when the user leaves the field, and also
  // when the selection moves on while the field keeps focus (undo, the canvas) or the panel closes.
  const openSession = useRef<{ readonly nodeId: string; readonly key: string } | null>(null);
  useEffect(() => {
    const open = openSession.current;
    if (open !== null && open.nodeId !== selectedId) {
      history.endSession(open.key);
      openSession.current = null;
    }
  }, [history, selectedId]);
  useEffect(
    () => () => {
      const open = openSession.current;
      if (open !== null) history.endSession(open.key);
    },
    [history],
  );

  if (page === undefined || node === undefined || component === undefined) {
    return <EditPanel fields={[]} onChange={() => undefined} onCommit={() => undefined} />;
  }

  const fields = Object.entries(component.fields).flatMap(([name, field]): EditPanelField[] => {
    const kind = rendererKind(field);
    return kind === undefined
      ? []
      : [
          {
            name,
            kind,
            label: field.label,
            group: groupOf(field),
            value: node.props[name],
            ...(field.kind === "select" ? { options: field.options } : {}),
          },
        ];
  });
  const textKey = (name: string) => `field:${pageId}:${node.props.id}:${name}`;

  const change = (name: string, value: unknown) => {
    const field = component.fields[name];
    if (field === undefined || !(typeof value === "string")) {
      return;
    }
    flush();
    const kind: EngineEditKind = field.kind === "text" ? "text" : "props";
    const label = labelFor(
      {
        kind,
        nodeId: node.props.id,
        componentType: node.type,
        field: name,
        page,
        selection: node.props.id,
      },
      library,
    );
    session.edit(
      kind,
      label,
      (draft) => {
        const target = draft.pages[pageId];
        if (target !== undefined) {
          applyPatch(target.doc, page, { nodeId: node.props.id, field: name, value });
        }
      },
      {
        selectionAfter: { pageId, viewport, nodeId: node.props.id },
        // Typing in a field is one step per visit (D1), like typing on the canvas.
        ...(field.kind === "text" ? { coalesceKey: textKey(name) } : {}),
      },
    );
    if (field.kind === "text") {
      openSession.current = { nodeId: node.props.id, key: textKey(name) };
    }
  };

  return (
    <EditPanel
      heading={component.label}
      fields={fields}
      onChange={change}
      onCommit={(name) => {
        history.endSession(textKey(name));
        openSession.current = null;
      }}
    />
  );
}
