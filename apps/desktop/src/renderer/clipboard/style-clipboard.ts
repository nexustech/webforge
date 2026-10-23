import { t } from "@webforge/i18n";
import type { ComponentDef } from "@webforge/site-components";
import type { EditorSession } from "../editor/editor-session.js";
import { fieldGroupOf } from "../editor/field-group.js";
import { type FieldTarget, fieldTarget } from "../editor/field-target.js";
import { pastedStyleLabel } from "../editor/labels.js";
import type { CommandRegistry } from "../shell/commands.js";

/** What Copy Style keeps (1.37, UX-14): the element's type, and the values of its style fields. */
export type CopiedStyle = {
  readonly type: string;
  /** The component's display name, for the Paste Style label on other types. */
  readonly label: string;
  readonly values: Readonly<Record<string, unknown>>;
};

/** What the style clipboard needs of the editor session. */
export type StyleSession = Pick<EditorSession, "history" | "ui" | "library" | "edit">;

/**
 * The fields Copy Style copies: those on the Edit panel's Style tab (sizes, colours, spacing,
 * widths), never content, lists or slots.
 */
export function styleFieldsOf(component: ComponentDef): string[] {
  return Object.entries(component.fields)
    .filter(
      ([, field]) =>
        fieldGroupOf(field) === "style" &&
        field.kind !== "list" &&
        field.kind !== "slot" &&
        field.kind !== "richtext",
    )
    .map(([name]) => name);
}

/** The selected element, as the Edit panel changes it, if one is selected. */
function selectedTarget(session: StyleSession): FieldTarget | undefined {
  const { pageId, nodeId } = session.ui.getState();
  return fieldTarget(session.history.document.getState(), session.library, pageId, nodeId);
}

/** The selected element's style, or undefined if nothing with a style is selected. */
export function copyStyle(session: StyleSession): CopiedStyle | undefined {
  const target = selectedTarget(session);
  if (target === undefined) return undefined;
  const names = styleFieldsOf(target.component);
  if (names.length === 0) return undefined;
  return {
    type: target.node.type,
    label: target.component.label,
    values: Object.fromEntries(
      names.map((name) => [name, structuredClone(target.storedOr(name, target.node.props[name]))]),
    ),
  };
}

/** Whether `copied` can be pasted onto the selected element: one of the same type. */
export function canPasteStyle(session: StyleSession, copied: CopiedStyle | undefined): boolean {
  return copied !== undefined && selectedTarget(session)?.node.type === copied.type;
}

/**
 * Gives the selected element `copied`'s style, as one undo step "Pasted style on Heading" (D2), or
 * named as any change in a linked copy is. Nothing is recorded when its style is the same already.
 * Returns whether it changed.
 */
export function pasteStyle(session: StyleSession, copied: CopiedStyle): boolean {
  const target = selectedTarget(session);
  if (target === undefined || target.node.type !== copied.type) return false;
  const changed = Object.entries(copied.values).filter(
    ([name, value]) =>
      JSON.stringify(target.storedOr(name, target.node.props[name])) !== JSON.stringify(value),
  );
  if (changed.length === 0) return false;
  const label = target.copyLabel ?? pastedStyleLabel(target.editOf("props", ""), session.library);
  session.edit("props", label, (draft) => {
    for (const [name, value] of changed) target.write(draft, name, () => structuredClone(value));
  });
  return true;
}

/**
 * Registers Copy Style and Paste Style (1.37, UX-14) in the Edit menu and the command box, with
 * Ctrl/Cmd+Alt+C and Ctrl/Cmd+Alt+V. The copied style is the editor's own, not the system
 * clipboard's or the document's. Paste Style is offered only for an element of the type copied
 * (its label then says which), and not in Content mode (M3). Returns a function that removes
 * them, and one that follows Content mode's lock.
 */
export function registerStyleCommands(
  registry: CommandRegistry,
  session: StyleSession,
  beforeAction: () => void,
): { readonly remove: () => void; readonly setLayoutLocked: (locked: boolean) => void } {
  let copied: CopiedStyle | undefined;
  let locked = false;
  const update = () => {
    const target = selectedTarget(session);
    registry.update("edit.copyStyle", {
      enabled: target !== undefined && styleFieldsOf(target.component).length > 0,
    });
    registry.update("edit.pasteStyle", {
      enabled: !locked && canPasteStyle(session, copied),
      label:
        copied === undefined || target?.node.type === copied.type
          ? t("edit.pasteStyle")
          : t("edit.pasteStyleOnto", { item: copied.label }),
    });
  };
  const removers = [
    registry.register({
      id: "edit.copyStyle",
      label: t("edit.copyStyle"),
      menu: "edit",
      shortcut: "Mod+Alt+C",
      enabled: false,
      run: () => {
        beforeAction();
        copied = copyStyle(session) ?? copied;
        update();
      },
    }),
    registry.register({
      id: "edit.pasteStyle",
      label: t("edit.pasteStyle"),
      menu: "edit",
      shortcut: "Mod+Alt+V",
      enabled: false,
      run: () => {
        if (locked || copied === undefined) return;
        beforeAction();
        pasteStyle(session, copied);
      },
    }),
    session.ui.subscribe(update),
    session.history.document.subscribe(update),
  ];
  update();
  return {
    remove: () => {
      for (const remove of removers) remove();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
