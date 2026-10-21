import { EditPanel, type EditPanelField, type ListChange } from "@webforge/editor-ui";
import type { EngineEdit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import {
  type Breakpoint,
  imageValueSchema,
  type NodeAdvanced,
  type NodeDoc,
  type SiteDoc,
} from "@webforge/model";
import type { FieldDef } from "@webforge/site-components";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  advancedFieldLabel,
  advancedFields,
  isAdvancedField,
  withAdvancedChange,
} from "./advanced-fields.js";
import { updateField } from "./apply-patch.js";
import type { EditorSession } from "./editor-session.js";
import { changedLabel, deviceLabelFor, labelFor } from "./labels.js";
import {
  applyListChange,
  type EditableList,
  editableList,
  listChangeLabel,
  listItems,
} from "./list-edit.js";
import { findNode } from "./nodes.js";
import {
  breakpointOf,
  isOverridden,
  valueAt,
  withoutOverride,
  withValueAt,
} from "./responsive-value.js";
import { sharedRegionOf, shownLayout, updateSharedField } from "./shared-layout.js";

/** The Edit panel's renderer kind for a field, or undefined for fields edited elsewhere. */
function rendererKind(field: FieldDef): string | undefined {
  switch (field.kind) {
    case "text":
    case "select":
    case "toggle":
    case "slider":
    case "color":
    case "spacing":
    case "list":
      return field.kind;
    // A Media image, with alt text for this placement (1.16): see ImageField.
    case "media":
      return "image";
    // Rich text is edited on the canvas (1.23), slots by dragging elements in (a slot of one type
    // is a list: see editableList).
    case "richtext":
    case "slot":
      return undefined;
  }
}

/** The tab a field goes on: its own `group`, else Content for text and images, else Style. */
function groupOf(field: FieldDef): "content" | "style" {
  return field.group ?? (field.kind === "text" || field.kind === "media" ? "content" : "style");
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

/** The Edit panel field for a list: its items, and the fields of an item's row. */
function listField(
  name: string,
  field: FieldDef,
  list: EditableList,
  stored: unknown,
): EditPanelField {
  return {
    name,
    kind: "list",
    label: field.label,
    group: field.group ?? "content",
    value: listItems(stored, list),
    itemLabel: list.itemLabel,
    itemFields: Object.entries(list.fields).flatMap(([itemName, def]) => {
      const kind = rendererKind(def);
      return kind === undefined
        ? []
        : [{ name: itemName, kind, label: def.label, ...choicesOf(def) }];
    }),
  };
}

/** Whether `value` is something a field of `field`'s kind stores. */
function accepts(field: FieldDef, value: unknown): boolean {
  switch (field.kind) {
    case "toggle":
      return typeof value === "boolean";
    // An image value, or none to take the image away.
    case "media":
      return value === undefined || imageValueSchema.safeParse(value).success;
    default:
      return typeof value === "string";
  }
}

/** A run of edits still open: typing in a text field, or a slider drag. */
type Run = {
  readonly nodeId: string;
  /** The panel field the run is in. */
  readonly name: string;
  /** The field, or a list item's field (`items:<key>:<field>`), the run is in. */
  readonly key: string;
  /** The device whose value the run sets; its label names it. */
  readonly breakpoint: Breakpoint;
  /** False once the run can take no more changes (a drag cancelled with Esc). */
  active(): boolean;
  /** Changes the document as part of the run (a drag); undefined for runs merged by key. */
  readonly update?: (recipe: (draft: SiteDoc) => void) => void;
  end(): void;
  /** Puts back what the run changed (a drag); undefined for runs that are kept as they are. */
  readonly cancel?: () => void;
};

/** Props of {@link EditPanelHost}. */
export type EditPanelHostProps = {
  readonly session: EditorSession;
  /** Ends a canvas text session before the panel changes the document. */
  readonly flush: () => void;
  /** Shows the Advanced tab: classes, attributes and the anchor (Advanced mode, F-ED-11). */
  readonly advanced?: boolean;
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
export function EditPanelHost({ session, flush, advanced = false }: EditPanelHostProps) {
  const { history, ui, library } = session;
  const site = useSyncExternalStore(history.document.subscribe, history.document.getState);
  const { pageId, nodeId, viewport } = useSyncExternalStore(ui.subscribe, ui.getState);
  const page = site.pages[pageId]?.doc;
  const isSelected = (candidate: NodeDoc) => candidate.props.id === nodeId;
  const ownNode =
    page === undefined || nodeId === null ? undefined : findNode(page.content, isSelected);
  // Not the page's own: an element of the shared Header or Footer the page shows, whose changes go
  // to the site's layout and show on every page (F-ED-7).
  const region =
    ownNode !== undefined || nodeId === null
      ? undefined
      : sharedRegionOf(shownLayout(site, pageId), nodeId);
  const node = region === undefined ? ownNode : findNode(site.layout[region], isSelected);
  const component = node === undefined ? undefined : library.components[node.type];
  const selectedId = node?.props.id;
  const breakpoint = breakpointOf(viewport);
  const device = t(`device.${breakpoint}`);

  // The run ends when the user leaves the field, and also when the selection or the device view
  // moves on while the field keeps focus (undo, the canvas). Closing the panel mid-drag cancels the
  // drag, like any gesture whose control goes away (U2).
  const openRun = useRef<Run | null>(null);
  useEffect(() => {
    const run = openRun.current;
    if (run !== null && (run.nodeId !== selectedId || run.breakpoint !== breakpoint)) {
      openRun.current = null;
      run.end();
    }
  }, [selectedId, breakpoint]);
  useEffect(
    () => () => {
      const run = openRun.current;
      openRun.current = null;
      if (run?.cancel !== undefined) run.cancel();
      else run?.end();
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
    const list = editableList(field, library);
    if (list !== undefined) {
      return [listField(name, field, list, node.props[name])];
    }
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

  if (advanced) {
    // Anchors other elements use on this page, including the shared Header and Footer; for an
    // element of the Header or Footer, on every page that shows it.
    const takenAnchors: string[] = [];
    const pages =
      region === undefined
        ? [page]
        : Object.values(site.pages)
            .filter((other) => shownLayout(site, other.id)[region].length > 0)
            .map((other) => other.doc);
    const nodes = pages.flatMap((other) => other.content);
    findNode([...site.layout.header, ...nodes, ...site.layout.footer], (other) => {
      const anchor = other.props.advanced?.anchorId;
      if (anchor !== undefined && other.props.id !== id) takenAnchors.push(anchor);
      return false;
    });
    fields.push(...advancedFields(node.props.advanced, takenAnchors));
  }

  /** An edit of the selected element, to name in undo labels: "Changed shared Footer size". */
  const editOf = (kind: EngineEdit["kind"], field: string): EngineEdit => ({
    kind,
    nodeId: id,
    componentType: node.type,
    field,
    page,
    selection: id,
    ...(region === undefined ? {} : { shared: true, layout: site.layout }),
  });

  /** The undo label for a change to `name`; "… on Mobile" where it sets one device's value. */
  const labelOf = (name: string, field: FieldDef, reset = false) => {
    const edit = editOf(field.kind === "text" ? "text" : "props", name);
    return field.responsive === true && (reset || breakpoint !== "desktop")
      ? deviceLabelFor(edit, library, device, reset)
      : labelFor(edit, library);
  };

  /** Sets field `name` of the selected element to what `next` makes of it, in `draft`. */
  const write = (draft: SiteDoc, name: string, next: (stored: unknown) => unknown) => {
    if (region !== undefined) {
      updateSharedField(draft.layout, site.layout, region, id, name, next);
      return;
    }
    const target = draft.pages[pageId];
    if (target !== undefined) {
      updateField(target.doc, page, id, name, next);
    }
  };
  /** Sets field `name` to what `next` makes of its stored value, in the document being edited. */
  const recipe = (name: string, next: (stored: unknown) => unknown) => (draft: SiteDoc) =>
    write(draft, name, (stored) => next(storedOr(name, stored)));
  const selectionAfter = { pageId, viewport, nodeId: id };

  /** A change on the Advanced tab: one step, "Changed Heading CSS classes". */
  const changeAdvanced = (name: string, value: unknown) => {
    endRun();
    flush();
    const label = changedLabel(editOf("props", name), library, advancedFieldLabel(name));
    session.edit(
      "props",
      label,
      (draft) =>
        write(draft, "advanced", (stored) =>
          withAdvancedChange(stored as NodeAdvanced | undefined, name, value),
        ),
      { selectionAfter },
    );
  };

  const change = (name: string, value: unknown) => {
    if (isAdvancedField(name)) {
      changeAdvanced(name, value);
      return;
    }
    const field = component.fields[name];
    const list = field === undefined ? undefined : editableList(field, library);
    if (list !== undefined) {
      changeList(name, list, value as ListChange);
      return;
    }
    if (field === undefined || !accepts(field, value)) {
      return;
    }
    const next = (stored: unknown) =>
      field.responsive === true ? withValueAt(stored, breakpoint, value) : value;
    if (field.kind === "slider") {
      // A drag is one step, shown live as it goes (U2).
      const run = openRun.current;
      if (run?.update !== undefined && run.key === name && run.nodeId === id && run.active()) {
        run.update(recipe(name, next));
        return;
      }
      endRun();
      flush();
      const gesture = session.begin("props", labelOf(name, field));
      openRun.current = {
        nodeId: id,
        name,
        key: name,
        breakpoint,
        active: () => gesture.active,
        update: (change) => gesture.update(change),
        end: () => {
          if (gesture.active) gesture.commit({ selectionAfter });
        },
        cancel: () => {
          if (gesture.active) gesture.cancel();
        },
      };
      gesture.update(recipe(name, next));
      return;
    }
    if (openRun.current?.key !== name) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${id}:${name}`;
    // Typing in a field is one step per visit (D1), like typing on the canvas: a text field, or
    // an image's alt text for this placement.
    const typed = field.kind === "text" || field.kind === "media";
    session.edit(
      field.kind === "text" ? "text" : "props",
      labelOf(name, field),
      recipe(name, next),
      { selectionAfter, ...(typed ? { coalesceKey: textKey } : {}) },
    );
    if (typed) {
      openRun.current = {
        nodeId: id,
        name,
        key: name,
        breakpoint,
        active: () => true,
        end: () => history.endSession(textKey),
      };
    }
  };

  /**
   * One change to a list (F-ED-6), as one step: "Added Question". Typing in an item's text field
   * is one step per visit, like any text field, and so is a drag of an item's slider.
   */
  const changeList = (name: string, list: EditableList, change: ListChange) => {
    const itemKind = change.type === "edit" ? list.fields[change.name]?.kind : undefined;
    const text = itemKind === "text";
    const merged = text || itemKind === "slider";
    const runKey = change.type === "edit" ? `${name}:${change.key}:${change.name}` : name;
    if (openRun.current?.key !== runKey) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${id}:${runKey}`;
    const textLabel = (key: string, field: string) =>
      labelFor(
        {
          ...editOf("text", field),
          nodeId: key,
          componentType: list.holds === "elements" ? list.type : null,
        },
        library,
      );
    session.edit(
      text ? "text" : "props",
      listChangeLabel(change, list, textLabel),
      (draft) =>
        write(draft, name, (stored) => {
          // A list never set starts from (a copy of) the component's default.
          const items = Array.isArray(stored)
            ? stored
            : structuredClone(component.defaults[name] ?? []);
          applyListChange(Array.isArray(items) ? items : [], change, list);
          return items;
        }),
      { selectionAfter, ...(merged ? { coalesceKey: textKey } : {}) },
    );
    if (merged) {
      openRun.current = {
        nodeId: id,
        name,
        key: runKey,
        breakpoint,
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
      advanced={advanced}
      itemKey={id}
    />
  );
}
