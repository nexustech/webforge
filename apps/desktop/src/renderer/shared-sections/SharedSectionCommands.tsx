import { t } from "@webforge/i18n";
import type { EditorSession } from "../editor/editor-session.js";
import type { CommandRegistry } from "../shell/commands.js";
import { NameDialog } from "../site/NameDialog.js";
import {
  copySelection,
  detachCopy,
  savableSection,
  saveAsSharedSection,
} from "./shared-sections.js";

/** The commands' ids, for the Edit menu and the command box. */
const SHARED_SECTION_COMMANDS = {
  save: "edit.saveSharedSection",
  detach: "edit.detachSharedSection",
} as const;

/** The longest name a shared section may have, as the site file allows. */
const MAX_NAME = 100;

/**
 * Registers *Save as shared section…* and *Detach from shared section* (1.29, F-ED-23) in the
 * Edit menu and the command box. Save needs a section of the page itself selected, and asks for
 * the new shared section's name (`askName`, with a first suggestion); Detach needs an element of a
 * copy selected. Both change the layout, so Content mode's lock (M3) turns them off. Returns a
 * function that removes them, and one that follows the lock.
 */
export function registerSharedSectionCommands(
  registry: CommandRegistry,
  session: EditorSession,
  beforeAction: () => void,
  askName: (suggested: string) => void,
): { readonly remove: () => void; readonly setLayoutLocked: (locked: boolean) => void } {
  let locked = false;
  const removers = [
    registry.register({
      id: SHARED_SECTION_COMMANDS.save,
      label: t("canvas.saveSharedSection"),
      menu: "edit",
      enabled: false,
      run: () => {
        beforeAction();
        const { pageId, nodeId } = session.ui.getState();
        const section = savableSection(session.history.document.getState(), pageId, nodeId);
        if (section === undefined) return;
        const name =
          section.props.layerName?.trim() ||
          (session.library.components[section.type]?.label ?? section.type);
        askName(name.slice(0, MAX_NAME));
      },
    }),
    registry.register({
      id: SHARED_SECTION_COMMANDS.detach,
      label: t("canvas.detachSharedSection"),
      menu: "edit",
      enabled: false,
      run: () => {
        beforeAction();
        detachCopy(session);
      },
    }),
  ];
  const update = () => {
    const site = session.history.document.getState();
    const { pageId, nodeId } = session.ui.getState();
    registry.update(SHARED_SECTION_COMMANDS.save, {
      enabled: !locked && savableSection(site, pageId, nodeId) !== undefined,
    });
    registry.update(SHARED_SECTION_COMMANDS.detach, {
      enabled: !locked && copySelection(site, pageId, nodeId) !== undefined,
    });
  };
  update();
  const stopUi = session.ui.subscribe(update);
  const stopDocument = session.history.document.subscribe(update);
  return {
    remove: () => {
      stopUi();
      stopDocument();
      for (const remove of removers) remove();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}

/**
 * Asks for the name of the shared section the selected section is saved as (F-ED-23), and saves
 * it: one step, "Saved 'Opening hours' as a shared section".
 */
export function SaveSharedSectionDialog({
  session,
  suggested,
  onClose,
}: {
  readonly session: EditorSession;
  /** The name to start from; the dialog is closed while this is null. */
  readonly suggested: string | null;
  readonly onClose: () => void;
}) {
  return (
    <NameDialog
      open={suggested !== null}
      title={t("canvas.saveSharedSection.title")}
      description={t("canvas.saveSharedSection.description")}
      label={t("canvas.saveSharedSection.name")}
      initialValue={suggested ?? ""}
      maxLength={MAX_NAME}
      confirm={t("canvas.saveSharedSection.confirm")}
      onSubmit={(name) => {
        onClose();
        saveAsSharedSection(session, name);
      }}
      onCancel={onClose}
    />
  );
}
