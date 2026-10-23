import { EditPanel, type EditPanelField, type ListChange } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  BOX_SIDES,
  type Breakpoint,
  boxValueSchema,
  colorRefSchema,
  imageValueSchema,
  type NodeAdvanced,
  type SiteDoc,
  SPACING_TOKENS,
} from "@webforge/model";
import type { FieldDef } from "@webforge/site-components";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { applyAnchor, asLinkFieldChange } from "../links/link-change.js";
import { anchorsTakenInSection } from "../shared-sections/shared-sections.js";
import {
  bindingLabel,
  boundFieldOf,
  isBindingField,
  withBinding,
  withBindingChoice,
} from "../site-settings/binding-fields.js";
import {
  advancedFieldLabel,
  advancedFields,
  isAdvancedField,
  withAdvancedChange,
} from "./advanced-fields.js";
import type { EditorSession } from "./editor-session.js";
import { fieldGroupOf } from "./field-group.js";
import { fieldTarget } from "./field-target.js";
import { changedLabel, labelFor } from "./labels.js";
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
import { shownLayout } from "./shared-layout.js";

/** The Edit panel's renderer kind for a field, or undefined for fields edited elsewhere. */
function rendererKind(field: FieldDef): string | undefined {
  switch (field.kind) {
    case "text":
    case "select":
    case "toggle":
    case "slider":
    case "color":
    case "spacing":
    case "box":
    case "list":
      return field.kind;
    // A Media image, with alt text for this placement (1.16): see ImageField.
    case "media":
      return "image";
    // Where a link goes (1.19): see LinkField.
    case "link":
      return "link";
    // Rich text is edited on the canvas (1.23), slots by dragging elements in (a slot of one type
    // is a list: see editableList).
    case "richtext":
    case "slot":
      return undefined;
  }
}

/** The choices or steps a field offers, for its renderer. */
function choicesOf(field: FieldDef): Pick<EditPanelField, "options" | "steps" | "sides"> {
  switch (field.kind) {
    case "select":
    case "color":
    case "spacing":
      return { options: field.options };
    case "slider":
      return { steps: field.steps };
    // Padding or margin per side (1.32): a spacing token for each side.
    case "box":
      return {
        options: SPACING_TOKENS.map((value) => ({ label: t(`field.spacing.${value}`), value })),
        sides: (field.sides ?? BOX_SIDES).map((value) => ({
          label: t(`field.side.${value}`),
          value,
        })),
      };
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
    // A link, or none, and maybe the anchor a section needs for it (LinkFieldChange).
    case "link":
      return asLinkFieldChange(value) !== undefined;
    case "box":
      return boxValueSchema.safeParse(value).success;
    // A colour ref (ADR 0009), or the element's own colour.
    case "color":
      return value === "default" || colorRefSchema.safeParse(value).success;
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
  /** Shows the Content tab only: Content mode locks styles and the Advanced settings (M3). */
  readonly contentOnly?: boolean;
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
export function EditPanelHost({
  session,
  flush,
  advanced = false,
  contentOnly = false,
}: EditPanelHostProps) {
  const { history, ui, library } = session;
  const site = useSyncExternalStore(history.document.subscribe, history.document.getState);
  const { pageId, nodeId, viewport, others = [] } = useSyncExternalStore(ui.subscribe, ui.getState);
  const target = fieldTarget(site, library, pageId, nodeId);
  const selectedId = target?.id;
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

  if (others.length > 0) {
    // Several selected elements (1.31): editing their fields together comes later.
    return (
      <p
        role="status"
        className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground"
      >
        {t("editPanel.several", { count: others.length + 1 })}
      </p>
    );
  }
  if (target === undefined) {
    return <EditPanel fields={[]} onChange={() => undefined} onCommit={() => undefined} />;
  }
  const { page, node, component, id, region, inCopy, copyLabel, storedOr, editOf, write, recipe } =
    target;
  const labelOf = (name: string, field: FieldDef, reset = false) =>
    target.labelOf(name, field, breakpoint, reset);

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
    // A text field that can show a Site Settings value gets a choice of what it shows (1.17).
    return withBindingChoice(name, field, node.props.bindings, [
      {
        name,
        kind,
        label: field.label,
        group: fieldGroupOf(field),
        value: responsive ? valueAt(stored, breakpoint) : stored,
        ...(responsive && isOverridden(stored, breakpoint) ? { overridden: true } : {}),
        ...choicesOf(field),
      },
    ]);
  });

  if (advanced && inCopy !== undefined) {
    // An anchor of a shared section shows in every copy, on every page with one.
    const taken = anchorsTakenInSection(site, inCopy.shared.id, inCopy.node.props.id);
    fields.push(...advancedFields(node.props.advanced, taken));
  } else if (advanced) {
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

  const selectionAfter = { pageId, viewport, nodeId: id };

  /** A change on the Advanced tab: one step, "Changed Heading CSS classes". */
  const changeAdvanced = (name: string, value: unknown) => {
    endRun();
    flush();
    const label =
      copyLabel ?? changedLabel(editOf("props", name), library, advancedFieldLabel(name));
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

  /** What a text field shows: its own text or a Site Settings value; one step (1.17). */
  const changeBinding = (name: string, value: unknown) => {
    if (component.fields[name] === undefined) return;
    endRun();
    flush();
    session.edit(
      "props",
      copyLabel ?? bindingLabel(component.label, value),
      recipe("bindings", (stored) => withBinding(stored, name, value)),
      { selectionAfter },
    );
  };

  /**
   * A new link (1.19): one step, "Changed Hero Button link", which also gives the target section
   * its anchor when the link is the first to it.
   */
  const changeLink = (name: string, field: FieldDef, value: unknown) => {
    const linkChange = asLinkFieldChange(value);
    if (linkChange === undefined) {
      return;
    }
    endRun();
    flush();
    session.edit(
      "props",
      labelOf(name, field),
      (draft) => {
        write(draft, name, () => linkChange.link);
        if (linkChange.anchor !== undefined) applyAnchor(draft, site, linkChange.anchor);
      },
      { selectionAfter },
    );
  };

  const change = (name: string, value: unknown) => {
    if (isAdvancedField(name)) {
      changeAdvanced(name, value);
      return;
    }
    if (isBindingField(name)) {
      changeBinding(boundFieldOf(name), value);
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
    if (field.kind === "link") {
      changeLink(name, field, value);
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
      copyLabel ?? listChangeLabel(change, list, textLabel),
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
      contentOnly={contentOnly}
      itemKey={id}
    />
  );
}
