import {
  EditPanel,
  type EditPanelField,
  type FieldSpec,
  type GroupAction,
  type ListChange,
  type PlainFieldKind,
  sameValue,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  BOX_SIDES,
  type Breakpoint,
  boxValueSchema,
  colorRefSchema,
  findNode,
  imageValueSchema,
  type NodeAdvanced,
  type NodeDoc,
  type SiteDoc,
  SPACING_TOKENS,
} from "@webforge/model";
import {
  APPEARANCE_FIELDS,
  type ComponentLibrary,
  type FieldDef,
  fieldsHiddenBy,
  isIconName,
  textStylesOf,
  withLook,
} from "@webforge/site-components";
import { useEffect, useRef } from "react";
import {
  advancedFieldLabel,
  advancedFields,
  isAdvancedField,
  withAdvancedChange,
} from "./advanced-fields.js";
import {
  bindingLabel,
  boundFieldOf,
  isBindingField,
  withBinding,
  withBindingChoice,
} from "./binding-fields.js";
import type { EditorSession } from "./editor-session.js";
import { fieldGroupOf } from "./field-group.js";
import { type FieldTarget, fieldTarget } from "./field-target.js";
import { changedLabel, labelFor, pasteGroupLabel, resetGroupLabel, resetLabel } from "./labels.js";
import { applyAnchor, asLinkFieldChange } from "./link-change.js";
import {
  applyListChange,
  type EditableList,
  editableList,
  listChangeLabel,
  listItems,
} from "./list-edit.js";
import { overlayWarning } from "./overlay-warning.js";
import { placedOverlay } from "./placed-overlay.js";
import { provenanceOf } from "./provenance.js";
import { resetValue } from "./reset-value.js";
import {
  breakpointOf,
  DEVICES,
  differsFromDefault,
  isOverridden,
  sourceOf,
  valueAt,
  withoutOverride,
  withValueAt,
} from "./responsive-value.js";
import { shownLayout } from "./shared-layout.js";
import { anchorsTakenInSection } from "./shared-sections.js";
import { useDocument, useUi } from "./use-document.js";

/**
 * The Edit panel's spec for a field (R11): its kind with everything its renderer needs, or undefined
 * for fields edited elsewhere. Rich text is edited on the canvas (1.23), slots by dragging elements
 * in. Lists, and slots of one type, are drawn as lists by {@link listField} (see editableList).
 */
export function specOf(field: FieldDef): FieldSpec | undefined {
  const { label } = field;
  switch (field.kind) {
    case "text":
      return { kind: "text", label };
    case "toggle":
      return { kind: "toggle", label };
    case "select":
      return { kind: "select", label, options: field.options };
    case "color":
      return { kind: "color", label, options: field.options };
    case "spacing":
      return { kind: "spacing", label, options: field.options };
    case "slider":
      return { kind: "slider", label, steps: field.steps };
    // Padding or margin per side (1.32): a spacing token for each side.
    case "box":
      return {
        kind: "box",
        label,
        options: SPACING_TOKENS.map((value) => ({ label: t(`field.spacing.${value}`), value })),
        sides: (field.sides ?? BOX_SIDES).map((value) => ({
          label: t(`field.side.${value}`),
          value,
        })),
      };
    // A Media image, with alt text for this placement (1.16): see ImageField.
    case "media":
      return { kind: "image", label };
    // Where a link goes (1.19): see LinkField.
    case "link":
      return { kind: "link", label };
    // One of Lucide's icons (F-ED-22): see IconField.
    case "icon":
      return { kind: "icon", label };
    case "code":
      return { kind: "code", label };
    case "list":
    case "richtext":
    case "slot":
      return undefined;
  }
}

/** The spec of a field an item of a list can have: a plain value. */
function itemSpecOf(field: FieldDef): FieldSpec<PlainFieldKind> | undefined {
  const spec = specOf(field);
  switch (spec?.kind) {
    case "text":
    case "select":
    case "toggle":
    case "slider":
    case "color":
    case "spacing":
      return spec;
    default:
      return undefined;
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
      const spec = itemSpecOf(def);
      return spec === undefined ? [] : [{ ...spec, name: itemName }];
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
    // One of Lucide's icons, or none to take it away.
    case "icon":
      return value === undefined || isIconName(value);
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

/**
 * The anchors other elements use (Advanced tab, F-ED-11): in a copy, those its shared section's
 * anchors may not repeat; else the page's own, including the shared Header and Footer, and for an
 * element of the Header or Footer, every page that shows it.
 */
function takenAnchors(site: SiteDoc, target: FieldTarget): string[] {
  if (target.inCopy !== undefined) {
    return anchorsTakenInSection(site, target.inCopy.shared.id, target.inCopy.node.props.id);
  }
  const taken: string[] = [];
  const { region } = target;
  const pages =
    region === undefined
      ? [target.page]
      : Object.values(site.pages)
          .filter((other) => shownLayout(site, other.id)[region].length > 0)
          .map((other) => other.doc);
  const nodes = pages.flatMap((other) => other.content);
  findNode([...site.layout.header, ...nodes, ...site.layout.footer], (other) => {
    const anchor = other.props.advanced?.anchorId;
    if (anchor !== undefined && other.props.id !== target.id) taken.push(anchor);
    return false;
  });
  return taken;
}

/** What the panel draws of the site: the selected element, and in Advanced mode the anchors taken. */
type PanelSlice = { readonly target: FieldTarget | undefined; readonly anchors: string[] };

/**
 * Whether `a` and `b`, two states of the element of component `component`, look the same in the
 * panel: the same values, besides the elements in its slots, which the panel doesn't show (unless
 * it edits them as a list). Typing in a Section's Heading leaves the Section's panel as it is.
 */
function samePanelValues(
  a: NodeDoc,
  b: NodeDoc,
  component: FieldTarget["component"],
  library: ComponentLibrary,
): boolean {
  if (a === b) return true;
  const names = new Set([...Object.keys(a.props), ...Object.keys(b.props)]);
  for (const name of names) {
    const field = component.fields[name];
    const shown = field?.kind !== "slot" || editableList(field, library) !== undefined;
    if (shown && !sameValue(a.props[name], b.props[name])) return false;
  }
  return true;
}

/**
 * Whether the panel would draw the same: the same element, with the same values, in the same place
 * (R9). Anything else in the document, such as typing in another element, leaves it as it is.
 */
function sameSlice(a: PanelSlice, b: PanelSlice, library: ComponentLibrary): boolean {
  const x = a.target;
  const y = b.target;
  if (x === undefined || y === undefined) return x === y && sameValue(a.anchors, b.anchors);
  return (
    x.id === y.id &&
    x.component === y.component &&
    x.region === y.region &&
    x.copyLabel === y.copyLabel &&
    samePanelValues(x.node, y.node, x.component, library) &&
    sameValue(a.anchors, b.anchors)
  );
}

/** Props of {@link EditPanelHost}. */
export type EditPanelHostProps = {
  readonly session: EditorSession;
  /** Ends a canvas text session before the panel changes the document. */
  readonly flush: () => void;
  /** Shows the Advanced tab: classes, attributes and the anchor (Advanced mode, F-ED-11). */
  readonly advanced?: boolean;
  /** Shows the Content tab only: Content mode locks styles and the Advanced settings (M3). */
  readonly contentOnly?: boolean;
  /**
   * The option groups the person closed, by component type (UX-13), and how to change them: UI
   * state, kept in the preferences, never in the document.
   */
  readonly closedGroups?: Readonly<Record<string, readonly string[]>>;
  readonly onClosedGroupsChange?: (type: string, closed: readonly string[]) => void;
  /** The app's actions in an option group's right-click menu: Apply Look to Every… (2.27). */
  readonly groupActions?: (id: string) => readonly GroupAction[];
  /**
   * Shows where an Appearance field's value comes from (CT-3): a Theme tab field, or a kind's look
   * (`look:‹type›`). Without it, the words say so but show nothing.
   */
  readonly revealSource?: (target: string) => void;
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
  closedGroups,
  onClosedGroupsChange,
  groupActions,
  revealSource,
}: EditPanelHostProps) {
  const { history, library } = session;
  const { pageId, nodeId, viewport, others = [] } = useUi(session, (ui) => ui);
  const { target, anchors } = useDocument(
    session,
    (site): PanelSlice => {
      const found = fieldTarget(site, library, pageId, nodeId);
      return { target: found, anchors: advanced && found ? takenAnchors(site, found) : [] };
    },
    (a, b) => sameSlice(a, b, library),
  );
  // The theme the section's overlay warning checks its text against (2.26).
  const theme = useDocument(session, (site) => site.theme);
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
  const { node, component, id, storedOr } = target;
  // A change is written to the element as the document has it now, never as an older drawing of
  // the panel found it, since the panel only redraws when its own element changes (R9). Once the
  // element has gone, a change still on its way does nothing.
  const now = () => fieldTarget(history.document.getState(), library, pageId, nodeId);

  // What a field's `unavailable` is asked about: the element's values, over its kind's look from
  // the theme (3.12) and its defaults.
  const values = { ...component.defaults, ...withLook(node.props, node.type, theme.looks) };
  // A layout that doesn't use a field hides it; its value stays for the layouts that do (#311).
  const hidden = fieldsHiddenBy(component, values);
  // What the Appearance group's words say its values come from (3.12, CT-3).
  const look: Readonly<Record<string, unknown>> = theme.looks?.[node.type] ?? {};
  const textStyles = textStylesOf(node, library, theme.looks);
  const provenance = (name: string, label: string, own: unknown, responsive: boolean) => {
    const found = provenanceOf({
      name,
      label,
      own,
      look: look[name],
      initial: component.defaults[name],
      responsive,
      breakpoint,
      type: node.type,
      item: component.label,
      corners: component.themeCorners,
      classes: node.props.advanced?.className ?? "",
      textStyle: textStyles.length === 1 ? textStyles[0] : undefined,
      theme,
    });
    if (found === undefined) return {};
    const { text, reveal } = found;
    return {
      source: {
        text,
        ...(reveal === undefined || revealSource === undefined
          ? {}
          : { onReveal: () => revealSource(reveal) }),
      },
    };
  };
  const fields = Object.entries(component.fields).flatMap(([name, field]): EditPanelField[] => {
    if (hidden.has(name)) return [];
    const list = editableList(field, library);
    if (list !== undefined) {
      return [listField(name, field, list, node.props[name])];
    }
    const spec = specOf(field);
    if (spec === undefined) {
      return [];
    }
    // What it draws with (its own value, else its kind's look, else the default), and what it
    // sets itself: only that is set for a device or reset per device (3.12).
    const own = node.props[name];
    const stored = storedOr(name, own);
    const responsive = field.responsive === true;
    const unavailable = field.unavailable?.(values);
    const help = unavailable ?? field.help;
    const warning = overlayWarning(field, values, theme, component);
    // A text field that can show a Site Settings value gets a choice of what it shows (1.17).
    return withBindingChoice(name, field, node.props.bindings, [
      {
        ...spec,
        name,
        group: fieldGroupOf(field),
        value: responsive ? valueAt(stored, breakpoint) : stored,
        ...(field.optionGroup === undefined ? {} : { optionGroup: field.optionGroup }),
        ...(help === undefined ? {} : { help }),
        ...(warning === undefined ? {} : { warning }),
        ...(field.optionGroup?.id === APPEARANCE_FIELDS.lookShadow.optionGroup.id
          ? provenance(name, field.label, own, responsive)
          : {}),
        // Its Reset leaves it to its kind's look, where the theme has one for it (3.12): on
        // Desktop, while no other device keeps a value of its own (#567).
        ...(look[name] !== undefined &&
        breakpoint === "desktop" &&
        !isOverridden(own, "tablet") &&
        !isOverridden(own, "mobile")
          ? { resetLabel: t("editPanel.resetToLook") }
          : {}),
        ...(unavailable === undefined ? {} : { disabled: true }),
        ...(responsive && breakpoint !== "desktop" ? { responsive: true } : {}),
        ...(differsFromDefault(stored, storedOr(name, undefined), responsive, breakpoint)
          ? { changed: true }
          : {}),
        ...(responsive && isOverridden(own, breakpoint) ? { overridden: true } : {}),
        // Its value on each device, in rows of their own (SP-5).
        ...(responsive
          ? {
              devices: DEVICES.map((each) => ({
                id: each,
                label: t(`device.${each}`),
                value: valueAt(stored, each),
                own: each === "desktop" || isOverridden(own, each),
                inEffect: each === sourceOf(own, breakpoint),
              })),
            }
          : {}),
      },
    ]);
  });

  if (advanced) {
    fields.push(...advancedFields(node.props.advanced, anchors));
  }

  const selectionAfter = { pageId, viewport, nodeId: id };

  /** A change on the Advanced tab: one step, "Changed Heading CSS classes". */
  const changeAdvanced = (live: FieldTarget, name: string, value: unknown) => {
    endRun();
    flush();
    const label =
      live.copyLabel ?? changedLabel(live.editOf("props", name), library, advancedFieldLabel(name));
    session.edit(
      "props",
      label,
      (draft) =>
        live.write(draft, "advanced", (stored) =>
          withAdvancedChange(stored as NodeAdvanced | undefined, name, value),
        ),
      { selectionAfter },
    );
  };

  /** What a text field shows: its own text or a Site Settings value; one step (1.17). */
  const changeBinding = (live: FieldTarget, name: string, value: unknown) => {
    if (component.fields[name] === undefined) return;
    endRun();
    flush();
    session.edit(
      "props",
      live.copyLabel ?? bindingLabel(component.label, value),
      live.recipe("bindings", (stored) => withBinding(stored, name, value)),
      { selectionAfter },
    );
  };

  /**
   * A new link (1.19): one step, "Changed Hero Button link", which also gives the target section
   * its anchor when the link is the first to it.
   */
  const changeLink = (live: FieldTarget, name: string, field: FieldDef, value: unknown) => {
    const linkChange = asLinkFieldChange(value);
    if (linkChange === undefined) {
      return;
    }
    endRun();
    flush();
    session.edit(
      "props",
      live.labelOf(name, field, breakpoint),
      (draft) => {
        live.write(draft, name, () => linkChange.link);
        if (linkChange.anchor !== undefined) {
          applyAnchor(draft, history.document.getState(), linkChange.anchor);
        }
      },
      { selectionAfter },
    );
  };

  /**
   * A change to field `name`, for the device shown, or for device `at` from its row of the device
   * rows (SP-5): that device's value, named in its step ("Changed Section padding on Mobile").
   */
  const change = (name: string, value: unknown, at: Breakpoint = breakpoint) => {
    const live = now();
    if (live === undefined) return;
    if (isAdvancedField(name)) {
      changeAdvanced(live, name, value);
      return;
    }
    if (isBindingField(name)) {
      changeBinding(live, boundFieldOf(name), value);
      return;
    }
    const field = component.fields[name];
    const list = field === undefined ? undefined : editableList(field, library);
    if (list !== undefined) {
      changeList(live, name, list, value as ListChange);
      return;
    }
    if (field === undefined || !accepts(field, value)) {
      return;
    }
    if (field.kind === "link") {
      changeLink(live, name, field, value);
      return;
    }
    const next = (stored: unknown) =>
      field.responsive === true ? withValueAt(stored, at, value) : value;
    // Another device's row is a run of its own.
    const key = at === breakpoint ? name : `${name}@${at}`;
    if (field.kind === "slider") {
      // A drag is one step, shown live as it goes (U2).
      const run = openRun.current;
      if (run?.update !== undefined && run.key === key && run.nodeId === id && run.active()) {
        run.update(live.recipe(name, next));
        return;
      }
      endRun();
      flush();
      const gesture = session.begin("props", live.labelOf(name, field, at));
      openRun.current = {
        nodeId: id,
        name,
        key,
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
      gesture.update(live.recipe(name, next));
      return;
    }
    if (openRun.current?.key !== key) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${id}:${key}`;
    // Typing in a field is one step per visit (D1), like typing on the canvas: a text field, or
    // an image's alt text for this placement.
    const typed = field.kind === "text" || field.kind === "media";
    // A section's first background image brings the overlay its text needs (ST-9), in one step.
    const overlay = placedOverlay(
      field,
      {
        ...component.defaults,
        ...withLook(live.node.props, live.node.type, history.document.getState().theme.looks),
      },
      value,
      history.document.getState().theme,
      component,
    );
    const recipe = live.recipe(name, next);
    session.edit(
      field.kind === "text" ? "text" : "props",
      live.labelOf(name, field, at),
      overlay === undefined
        ? recipe
        : (draft) => {
            recipe(draft);
            live.write(draft, "overlay", () => overlay);
          },
      { selectionAfter, ...(typed ? { coalesceKey: textKey } : {}) },
    );
    if (typed) {
      openRun.current = {
        nodeId: id,
        name,
        key,
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
  const changeList = (live: FieldTarget, name: string, list: EditableList, change: ListChange) => {
    const itemKind = change.type === "edit" ? list.fields[change.name]?.kind : undefined;
    const text = itemKind === "text";
    const merged = text || itemKind === "slider";
    const runKey = change.type === "edit" ? `${name}:${change.id}:${change.name}` : name;
    if (openRun.current?.key !== runKey) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${id}:${runKey}`;
    const textLabel = (key: string, field: string) =>
      labelFor(
        {
          ...live.editOf("text", field),
          nodeId: key,
          componentType: list.holds === "elements" ? list.type : null,
        },
        library,
      );
    session.edit(
      text ? "text" : "props",
      live.copyLabel ?? listChangeLabel(change, list, textLabel),
      (draft) =>
        live.write(draft, name, (stored) => {
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
    const live = now();
    const field = component.fields[name];
    // Nothing of its own to reset: it follows its kind's look or its default already (3.12).
    if (live === undefined || field === undefined || live.node.props[name] === undefined) {
      return;
    }
    endRun();
    flush();
    session.edit(
      "props",
      live.labelOf(name, field, breakpoint, true),
      live.recipe(name, (stored) => withoutOverride(stored, breakpoint)),
      { selectionAfter },
    );
  };

  /**
   * Resets fields `names` to the component's defaults as one step (UX-13, UX-18): "Reset Heading
   * size", or for option group `group` "Reset Spacing on Heading". A field set per device gets its
   * default for the device shown: on Desktop its own value, elsewhere the Desktop value again, and
   * the label then names the device ("Reset Heading spacing on Mobile").
   */
  const resetToDefault = (names: readonly string[], group?: string) => {
    const live = now();
    const known = names.filter((name) => component.fields[name] !== undefined);
    const [first] = known;
    const firstField = first === undefined ? undefined : component.fields[first];
    if (live === undefined || first === undefined || firstField === undefined) {
      return;
    }
    endRun();
    flush();
    const forDevice =
      breakpoint !== "desktop" && known.some((name) => component.fields[name]?.responsive === true);
    const label =
      live.copyLabel ??
      (group !== undefined
        ? resetGroupLabel(
            live.editOf("props", first),
            library,
            group,
            forDevice ? device : undefined,
          )
        : firstField.responsive === true && breakpoint !== "desktop"
          ? live.labelOf(first, firstField, breakpoint, true)
          : resetLabel(live.editOf("props", first), library, firstField.label.toLocaleLowerCase()));
    session.edit(
      "props",
      label,
      (draft) => {
        const look = draft.theme.looks?.[live.node.type] as
          | Readonly<Record<string, unknown>>
          | undefined;
        for (const name of known) {
          const responsive = component.fields[name]?.responsive === true;
          live.write(draft, name, (stored) =>
            resetValue(stored, {
              responsive,
              breakpoint,
              initial: component.defaults[name],
              look: look?.[name],
            }),
          );
        }
      },
      { selectionAfter },
    );
  };

  /**
   * Sets an option group's values copied from an element (SP-7) as one step: "Pasted Spacing on
   * Heading". Only plain fields this element has and accepts the value for; a field set per device
   * takes it for the device shown.
   */
  const paste = (values: Readonly<Record<string, unknown>>, group: string) => {
    const live = now();
    const known = Object.entries(values).filter(([name, value]) => {
      const field = component.fields[name];
      return (
        field !== undefined &&
        field.kind !== "link" &&
        editableList(field, library) === undefined &&
        accepts(field, value)
      );
    });
    const [first] = known;
    if (live === undefined || first === undefined) return;
    endRun();
    flush();
    session.edit(
      "props",
      live.copyLabel ?? pasteGroupLabel(live.editOf("props", first[0]), library, group),
      (draft) => {
        for (const [name, value] of known) {
          const responsive = component.fields[name]?.responsive === true;
          live.write(draft, name, (stored) =>
            responsive
              ? withValueAt(stored, breakpoint, structuredClone(value))
              : structuredClone(value),
          );
        }
      },
      { selectionAfter },
    );
  };

  return (
    <EditPanel
      heading={component.label}
      fields={fields}
      device={device}
      onChange={(name, value) => change(name, value)}
      onChangeOn={(name, device, value) => {
        const at = DEVICES.find((each) => each === device);
        if (at !== undefined) change(name, value, at);
      }}
      onCommit={(name) => {
        if (openRun.current?.name === name) endRun();
      }}
      onReset={reset}
      onResetToDefault={resetToDefault}
      onPaste={paste}
      {...(groupActions === undefined ? {} : { groupActions })}
      {...(closedGroups === undefined
        ? {}
        : {
            closedGroups: closedGroups[node.type] ?? [],
            onClosedGroupsChange: (closed: readonly string[]) =>
              onClosedGroupsChange?.(node.type, closed),
          })}
      advanced={advanced}
      contentOnly={contentOnly}
      itemKey={id}
    />
  );
}
