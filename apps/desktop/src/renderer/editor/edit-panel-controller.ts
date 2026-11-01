import type { ListChange } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Breakpoint, NodeAdvanced, SiteDoc } from "@webforge/model";
import { acceptsFieldValue, type FieldDef, isIconName, withLook } from "@webforge/site-components";
import { advancedFieldLabel, isAdvancedField, withAdvancedChange } from "./advanced-fields.js";
import { bindingLabel, boundFieldOf, isBindingField, withBinding } from "./binding-fields.js";
import type { EditorSession } from "./editor-session.js";
import { fieldTarget } from "./field-target.js";
import { changedLabel, labelFor, pasteGroupLabel, resetGroupLabel, resetLabel } from "./labels.js";
import { applyAnchor, asLinkFieldChange } from "./link-change.js";
import {
  acceptedListChange,
  applyListChange,
  type EditableList,
  editableList,
  listChangeLabel,
} from "./list-edit.js";
import { placedOverlay } from "./placed-overlay.js";
import { resetValue } from "./reset-value.js";
import { breakpointOf, withoutOverride, withValueAt } from "./responsive-value.js";

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
 * Whether the panel may set `value` in `field`: what the field takes (#667), and for an icon one of
 * Lucide's, or none to take it away, as its picker offers.
 */
const panelTakes = (field: FieldDef, value: unknown) =>
  acceptsFieldValue(field, value, { responsive: false }) &&
  (field.kind !== "icon" || value === undefined || isIconName(value));

/** What the Edit panel does to the document, which {@link createEditPanelController} makes. */
export type EditPanelController = {
  /**
   * A change to field `name`, for the device shown, or for device `at` from its row of the device
   * rows (SP-5): that device's value, named in its step ("Changed Section padding on Mobile").
   */
  change(name: string, value: unknown, at?: Breakpoint): void;
  /** The person has left field `name`: the run of edits in it ends. */
  commit(name: string): void;
  /** Field `name`'s own value for the device shown dropped, for its kind's look or its default. */
  reset(name: string): void;
  /** Fields `names`, or option group `group`'s, reset to the component's defaults (UX-13, UX-18). */
  resetToDefault(names: readonly string[], group?: string): void;
  /** An option group's values, copied from an element, set as one step (SP-7). */
  paste(values: Readonly<Record<string, unknown>>, group: string): void;
  /**
   * The panel now shows element `selectedId` on device `breakpoint`: a run in another element, or
   * for another device, ends (undo or the canvas moved the selection while the field kept focus).
   */
  follow(selectedId: string | undefined, breakpoint: Breakpoint): void;
  /** The panel has gone: a drag still open is cancelled, like any gesture whose control goes (U2). */
  dispose(): void;
  /** `flush` from now on: the panel's owner may make it anew whenever it draws. */
  setFlush(flush: () => void): void;
};

/**
 * The Edit panel's changes to the selected element (1.14), each one labelled history step
 * ("Changed Heading size"), without React:
 * - typing in a text field is one step per visit to the field, merged as the person types and
 *   closed when they leave it;
 * - a slider drag is one step, shown live and ended when the slider is let go (Esc cancels it);
 * - a field that may differ per device (F-ED-4) sets the value of the device the canvas shows: on
 *   Tablet or Mobile that is an override of the Desktop value, which can be dropped again.
 *
 * A change is written to the element as the document has it now, never as an older drawing of the
 * panel found it (R9), and only a value its field takes (#667). Once the element has gone, a change
 * still on its way does nothing. `flush` (or the latest given to `setFlush`) ends a canvas text
 * session before the document changes.
 */
export function createEditPanelController(
  session: EditorSession,
  initialFlush: () => void = () => undefined,
): EditPanelController {
  const { history, library } = session;
  let open: Run | null = null;
  let flush = initialFlush;

  const endRun = () => {
    const run = open;
    open = null;
    run?.end();
  };

  /** Where the panel is: the page, the device shown, and the selected element as it is now. */
  const now = () => {
    const { pageId, nodeId, viewport } = session.ui.getState();
    const live = fieldTarget(history.document.getState(), library, pageId, nodeId);
    const breakpoint = breakpointOf(viewport);
    return live === undefined
      ? undefined
      : { live, pageId, breakpoint, selectionAfter: { pageId, viewport, nodeId: live.id } };
  };
  type Where = NonNullable<ReturnType<typeof now>>;

  /** A change on the Advanced tab: one step, "Changed Heading CSS classes". */
  const changeAdvanced = ({ live, selectionAfter }: Where, name: string, value: unknown) => {
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
  const changeBinding = ({ live, selectionAfter }: Where, name: string, value: unknown) => {
    if (live.component.fields[name] === undefined) return;
    endRun();
    flush();
    session.edit(
      "props",
      live.copyLabel ?? bindingLabel(live.component.label, value),
      live.recipe("bindings", (stored) => withBinding(stored, name, value)),
      { selectionAfter },
    );
  };

  /**
   * A new link (1.19): one step, "Changed Hero Button link", which also gives the target section
   * its anchor when the link is the first to it.
   */
  const changeLink = (
    { live, breakpoint, selectionAfter }: Where,
    name: string,
    field: FieldDef,
    value: unknown,
  ) => {
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
   * One change to a list (F-ED-6), as one step: "Added Question". Typing in an item's text field
   * is one step per visit, like any text field, and so is a drag of an item's slider.
   */
  const changeList = (where: Where, name: string, list: EditableList, change: ListChange) => {
    const { live, pageId, breakpoint, selectionAfter } = where;
    const itemKind = change.type === "edit" ? list.fields[change.name]?.kind : undefined;
    const text = itemKind === "text";
    const merged = text || itemKind === "slider";
    const runKey = change.type === "edit" ? `${name}:${change.id}:${change.name}` : name;
    if (open?.key !== runKey) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${live.id}:${runKey}`;
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
            : structuredClone(live.component.defaults[name] ?? []);
          applyListChange(Array.isArray(items) ? items : [], change, list);
          return items;
        }),
      { selectionAfter, ...(merged ? { coalesceKey: textKey } : {}) },
    );
    if (merged) {
      open = {
        nodeId: live.id,
        name,
        key: runKey,
        breakpoint,
        active: () => true,
        end: () => history.endSession(textKey),
      };
    }
  };

  const change = (name: string, value: unknown, given?: Breakpoint) => {
    const where = now();
    if (where === undefined) return;
    const { live, pageId, breakpoint, selectionAfter } = where;
    const at = given ?? breakpoint;
    if (isAdvancedField(name)) {
      changeAdvanced(where, name, value);
      return;
    }
    if (isBindingField(name)) {
      changeBinding(where, boundFieldOf(name), value);
      return;
    }
    const { component } = live;
    const field = component.fields[name];
    const list = field === undefined ? undefined : editableList(field, library);
    if (list !== undefined) {
      const accepted = acceptedListChange(value, list);
      if (accepted !== undefined) changeList(where, name, list, accepted);
      return;
    }
    if (field === undefined) {
      return;
    }
    if (field.kind === "link") {
      changeLink(where, name, field, value);
      return;
    }
    if (!panelTakes(field, value)) {
      return;
    }
    const next = (stored: unknown) =>
      field.responsive === true ? withValueAt(stored, at, value) : value;
    // Another device's row is a run of its own.
    const key = at === breakpoint ? name : `${name}@${at}`;
    if (field.kind === "slider") {
      // A drag is one step, shown live as it goes (U2).
      const run = open;
      if (run?.update !== undefined && run.key === key && run.nodeId === live.id && run.active()) {
        run.update(live.recipe(name, next));
        return;
      }
      endRun();
      flush();
      const gesture = session.begin("props", live.labelOf(name, field, at));
      open = {
        nodeId: live.id,
        name,
        key,
        breakpoint,
        active: () => gesture.active,
        update: (recipe) => gesture.update(recipe),
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
    if (open?.key !== key) {
      endRun();
    }
    flush();
    const textKey = `field:${pageId}:${live.id}:${key}`;
    // Typing in a field is one step per visit (D1), like typing on the canvas: a text field, or
    // an image's alt text for this placement.
    const typed = field.kind === "text" || field.kind === "media";
    const site = history.document.getState();
    // A section's first background image brings the overlay its text needs (ST-9), in one step.
    const overlay = placedOverlay(
      field,
      { ...component.defaults, ...withLook(live.node.props, live.node.type, site.theme.looks) },
      value,
      site.theme,
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
      open = {
        nodeId: live.id,
        name,
        key,
        breakpoint,
        active: () => true,
        end: () => history.endSession(textKey),
      };
    }
  };

  const reset = (name: string) => {
    const where = now();
    const field = where?.live.component.fields[name];
    // Nothing of its own to reset: it follows its kind's look or its default already (3.12).
    if (where === undefined || field === undefined || where.live.node.props[name] === undefined) {
      return;
    }
    const { live, breakpoint, selectionAfter } = where;
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
    const where = now();
    if (where === undefined) return;
    const { live, breakpoint, selectionAfter } = where;
    const { component } = live;
    const known = names.filter((name) => component.fields[name] !== undefined);
    const [first] = known;
    const firstField = first === undefined ? undefined : component.fields[first];
    if (first === undefined || firstField === undefined) {
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
            forDevice ? t(`device.${breakpoint}`) : undefined,
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
   * Heading". Only plain fields this element has, each with a value it takes (#667): a Section's
   * gap "none" isn't one of Columns' steps. A field set per device takes it for the device shown.
   */
  const paste = (values: Readonly<Record<string, unknown>>, group: string) => {
    const where = now();
    if (where === undefined) return;
    const { live, breakpoint, selectionAfter } = where;
    const { component } = live;
    const known = Object.entries(values).filter(([name, value]) => {
      const field = component.fields[name];
      return (
        field !== undefined &&
        field.kind !== "link" &&
        editableList(field, library) === undefined &&
        panelTakes(field, value)
      );
    });
    const [first] = known;
    if (first === undefined) return;
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

  return {
    change,
    commit: (name) => {
      if (open?.name === name) endRun();
    },
    reset,
    resetToDefault,
    paste,
    follow: (selectedId, breakpoint) => {
      const run = open;
      if (run !== null && (run.nodeId !== selectedId || run.breakpoint !== breakpoint)) {
        open = null;
        run.end();
      }
    },
    dispose: () => {
      const run = open;
      open = null;
      if (run?.cancel !== undefined) run.cancel();
      else run?.end();
    },
    setFlush: (next) => {
      flush = next;
    },
  };
}
