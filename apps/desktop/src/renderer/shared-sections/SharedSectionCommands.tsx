import { t } from "@webforge/i18n";
import { SHARED_SECTION_NAME_MAX, type SharedSectionId } from "@webforge/model";
import type { EditorSession } from "../editor/editor-session.js";
import { elementName } from "../editor/labels.js";
import {
  copySelection,
  deleteSharedSection,
  detachCopy,
  nameProblem,
  reachOf,
  renameSharedSection,
  type SharedSectionNaming,
  savableSection,
  saveAsSharedSection,
} from "../editor/shared-sections.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";
import { NameDialog } from "../shell/NameDialog.js";

/** The commands' ids, for the Edit menu and the command box. */
const SHARED_SECTION_COMMANDS = {
  save: "edit.saveSharedSection",
  rename: "edit.renameSharedSection",
  detach: "edit.detachSharedSection",
  delete: "edit.deleteSharedSection",
} as const;

/**
 * Deletes shared section `id` (F-ED-23), first asking, with how many pages have a copy (D7), when
 * any does: its copies become normal sections there. One undo step.
 */
export function removeSharedSection(
  session: EditorSession,
  id: SharedSectionId,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
): void {
  const site = session.history.document.getState();
  const shared = Object.hasOwn(site.sharedSections, id) ? site.sharedSections[id] : undefined;
  if (shared === undefined) return;
  const { pages } = reachOf(site, id);
  if (pages === 0 || siteWide === undefined) {
    deleteSharedSection(session, id);
    return;
  }
  void siteWide
    .confirmSiteWide({
      action: t("canvas.deleteSharedSection.title", {
        name: t("history.namedItem", { name: shared.name }),
      }),
      description: t("canvas.deleteSharedSection.description"),
      confirm: t("canvas.deleteSharedSection.confirm"),
      affectedPages: pages,
    })
    .then((confirmed) => {
      if (confirmed) deleteSharedSection(session, id);
    });
}

/**
 * Registers the shared-section commands (1.29, F-ED-23) in the Edit menu and the command box:
 * *Save as shared section…* for a section of the page itself; *Rename shared section…*, *Detach
 * from shared section* and *Delete shared section…* for an element of a copy. Save and Rename ask
 * for a name (`askName`); Delete asks first when copies are on pages (D7, `siteWide`). All change
 * the layout, so Content mode's lock (M3) turns them off. Returns a function that removes them,
 * and one that follows the lock.
 */
export function registerSharedSectionCommands(
  registry: CommandRegistry,
  session: EditorSession,
  beforeAction: () => void,
  askName: (naming: SharedSectionNaming) => void,
  siteWide?: Pick<SiteWideConfirm, "confirmSiteWide">,
): { readonly remove: () => void; readonly setLayoutLocked: (locked: boolean) => void } {
  let locked = false;
  /** The element of a copy selected on the page shown, if one is. */
  const selectedCopy = () => {
    const { pageId, nodeId } = session.ui.getState();
    return copySelection(session.history.document.getState(), pageId, nodeId);
  };
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
        const name = elementName(section, session.library);
        askName({ kind: "save", suggested: name.slice(0, SHARED_SECTION_NAME_MAX) });
      },
    }),
    registry.register({
      id: SHARED_SECTION_COMMANDS.rename,
      label: t("canvas.renameSharedSection"),
      menu: "edit",
      enabled: false,
      run: () => {
        beforeAction();
        const selected = selectedCopy();
        if (selected === undefined) return;
        askName({ kind: "rename", id: selected.shared.id, suggested: selected.shared.name });
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
    registry.register({
      id: SHARED_SECTION_COMMANDS.delete,
      label: t("canvas.deleteSharedSection"),
      menu: "edit",
      enabled: false,
      run: () => {
        beforeAction();
        const selected = selectedCopy();
        if (selected !== undefined) removeSharedSection(session, selected.shared.id, siteWide);
      },
    }),
  ];
  const update = () => {
    const site = session.history.document.getState();
    const { pageId, nodeId, others = [] } = session.ui.getState();
    // One section at a time: not while several elements are selected (1.31).
    const one = !locked && others.length === 0;
    const inCopy = one && selectedCopy() !== undefined;
    registry.update(SHARED_SECTION_COMMANDS.save, {
      enabled: one && savableSection(site, pageId, nodeId) !== undefined,
    });
    for (const id of [
      SHARED_SECTION_COMMANDS.rename,
      SHARED_SECTION_COMMANDS.detach,
      SHARED_SECTION_COMMANDS.delete,
    ]) {
      registry.update(id, { enabled: inCopy });
    }
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
 * Asks for a shared section's name (F-ED-23), refusing one another shared section has: to save the
 * selected section as one ("Saved 'Opening hours' as a shared section"), or to rename one
 * ("Renamed 'Hours' to 'Opening hours'"). One step either way.
 */
export function SharedSectionNameDialog({
  session,
  naming,
  onClose,
}: {
  readonly session: EditorSession;
  /** What the name is for; the dialog is closed while this is null. */
  readonly naming: SharedSectionNaming | null;
  readonly onClose: () => void;
}) {
  const rename = naming?.kind === "rename" ? naming : undefined;
  return (
    <NameDialog
      open={naming !== null}
      title={t(
        rename === undefined
          ? "canvas.saveSharedSection.title"
          : "canvas.renameSharedSection.title",
      )}
      {...(rename === undefined ? { description: t("canvas.saveSharedSection.description") } : {})}
      label={t("canvas.saveSharedSection.name")}
      initialValue={naming?.suggested ?? ""}
      maxLength={SHARED_SECTION_NAME_MAX}
      confirm={t(
        rename === undefined
          ? "canvas.saveSharedSection.confirm"
          : "canvas.renameSharedSection.confirm",
      )}
      problem={(name) => nameProblem(session.history.document.getState(), name, rename?.id)}
      onSubmit={(name) => {
        onClose();
        if (rename === undefined) saveAsSharedSection(session, name);
        else renameSharedSection(session, rename.id, name);
      }}
      onCancel={onClose}
    />
  );
}
