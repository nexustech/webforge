import { EditPanel, type EditPanelField } from "@webforge/editor-ui";
import type { EngineEdit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import type { FieldDef } from "@webforge/site-components";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { updateField } from "./apply-patch.js";
import type { EditorSession } from "./editor-session.js";
import { deviceLabelFor, labelFor } from "./labels.js";
import { findNode } from "./nodes.js";
import {
  breakpointOf,
  isOverridden,
  valueAt,
  withoutOverride,
  withValueAt,
} from "./responsive-value.js";

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

/** The tab a field goes on: its own `group`, else Content for text and Style for the rest. */
function groupOf(field: FieldDef): "content" | "style" {
  return field.group ?? (field.kind === "text" ? "content" : "style");
}

/** The choices or steps a field offers, for its renderer. */
function choicesOf(field: FieldDef): Pick<EditPanelField, "options" | "steps"> {
  switch (field.kind) {
    case "select":
    case "color":
    case "spacing":
      return { options: field.options };
    case "slider":
      return { steps: field.steps };
    default:
      return {};
  }
}

/** Whether `value` is something a field of `field`'s kind stores. */
function accepts(field: FieldDef, value: unknown): boolean {
  return field.kind === "toggle" ? typeof value === "boolean" : typeof value === "string";
}

/** A run of edits still open: typing in a text field, or a slider drag. */
type Run = {
  readonly nodeId: string;
  readonly name: string;
  /** False once the run can take no more changes (a drag cancelled with Esc). */
  active(): boolean;
  /** Changes the document as part of the run (a drag); undefined for runs merged by key. */
  readonly update?: (recipe: (draft: SiteDoc) => void) => void;
  end(): void;
};

/** Props of {@link EditPanelHost}. */
export type EditPanelHostProps = {
  readonly session: EditorSession;
  /** Ends a canvas text session before the panel changes the document. */
  readonly flush: () => void;
};

/**
 * The Edit panel for the element selected on the canvas (1.14). Every change is one labelled
 * history step ("Changed Heading size"):
 * - typing in a text field is one step per visit to the field, merged as the user types and closed
 *   when they leave it;
 * - a slider drag is one step, shown live and ended when the slider is let go (Esc cancels it);
 * - a field that may differ per device (F-ED-4) shows and sets the value of the device the canvas
 *   shows: on Tablet or Mobile that is an override of the Desktop value, which can be dropped again.
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
  const breakpoint = breakpointOf(viewport);
  const device = t(`device.${breakpoint}`);

  // The run ends when the user leaves the field, and also when the selection moves on while the
  // field keeps focus (undo, the canvas) or the panel closes.
  const openRun = useRef<Run | null>(null);
  useEffect(() => {
    const run = openRun.current;
    if (run !== null && run.nodeId !== selectedId) {
      openRun.current = null;
      run.end();
    }
  }, [selectedId]);
  useEffect(
    () => () => {
      openRun.current?.end();
      openRun.current = null;
    },
    [],
  );
  const endRun = () => {
    const run = openRun.current;
    openRun.current = null;
    run?.end();
  };

  if (page === undefined || node === undefined || component === undefined) {
    return <EditPanel fields={[]} onChange={() => undefined} onCommit={() => undefined} />;
  }
  const id = node.props.id;
  /** A field's stored value; one never set (older sites, new fields) has the component's default. */
  const storedOr = (name: string, stored: unknown) => stored ?? component.defaults[name];

  const fields = Object.entries(component.fields).flatMap(([name, field]): EditPanelField[] => {
    const kind = rendererKind(field);
    if (kind === undefined) {
      return [];
    }
    const stored = storedOr(name, node.props[name]);
    const responsive = field.responsive === true;
    return [
      {
        name,
        kind,
        label: field.label,
        group: groupOf(field),
        value: responsive ? valueAt(stored, breakpoint) : stored,
        ...(responsive && isOverridden(stored, breakpoint) ? { overridden: true } : {}),
        ...choicesOf(field),
      },
    ];
  });

  /** The undo label for a change to `name`; "… on Mobile" where it sets one device's value. */
  const labelOf = (name: string, field: FieldDef, reset = false) => {
    const edit: EngineEdit = {
      kind: field.kind === "text" ? "text" : "props",
      nodeId: id,
      componentType: node.type,
      field: name,
      page,
      selection: id,
    };
    return field.responsive === true && (reset || breakpoint !== "desktop")
      ? deviceLabelFor(edit, library, device, reset)
      : labelFor(edit, library);
  };

  /** Sets field `name` to what `next` makes of its stored value, in the document being edited. */
  const recipe = (name: string, next: (stored: unknown) => unknown) => (draft: SiteDoc) => {
    const target = draft.pages[pageId];
    if (target !== undefined) {
      updateField(target.doc, page, id, name, (stored) => next(storedOr(name, stored)));
    }
  };
  const selectionAfter = { pageId, viewport, nodeId: id };

  const change = (name: string, value: unknown) => {
    const field = component.fields[name];
    if (field === undefined || !accepts(field, value)) {
      return;
    }
    const next = (stored: unknown) =>
      field.responsive === true ? withValueAt(stored, breakpoint, value) : value;
    if (field.kind === "slider") {
      // A drag is one step, shown live as it goes (U2).
      const run = openRun.current;
      if (run?.update !== undefined && run.name === name && run.nodeId === id && run.active()) {
        run.update(recipe(name, next));
        return;
      }
      endRun();
      flush();
      const gesture = session.begin("props", labelOf(name, field));
      openRun.current = {
        nodeId: id,
        name,
        active: () => gesture.active,
        update: (change) => gesture.update(change),
        end: () => {
          if (gesture.active) gesture.commit({ selectionAfter });
        },
      };
      gesture.update(recipe(name, next));
      return;
    }
    if (openRun.current?.name !== name) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${id}:${name}`;
    session.edit(
      field.kind === "text" ? "text" : "props",
      labelOf(name, field),
      recipe(name, next),
      {
        selectionAfter,
        // Typing in a field is one step per visit (D1), like typing on the canvas.
        ...(field.kind === "text" ? { coalesceKey: textKey } : {}),
      },
    );
    if (field.kind === "text") {
      openRun.current = {
        nodeId: id,
        name,
        active: () => true,
        end: () => history.endSession(textKey),
      };
    }
  };

  const reset = (name: string) => {
    const field = component.fields[name];
    if (field === undefined) {
      return;
    }
    endRun();
    flush();
    session.edit(
      "props",
      labelOf(name, field, true),
      recipe(name, (stored) => withoutOverride(stored, breakpoint)),
      { selectionAfter },
    );
  };

  return (
    <EditPanel
      heading={component.label}
      fields={fields}
      device={device}
      onChange={change}
      onCommit={(name) => {
        if (openRun.current?.name === name) endRun();
      }}
      onReset={reset}
    />
  );
}
