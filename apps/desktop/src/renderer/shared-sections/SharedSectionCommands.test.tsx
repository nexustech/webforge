// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import type { EditorSession } from "../editor/editor-session.js";
import { copySelection, saveAsSharedSection } from "../editor/shared-sections.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import {
  registerSharedSectionCommands,
  removeSharedSection,
  SharedSectionNameDialog,
} from "./SharedSectionCommands.js";

// The shared-section commands and their name dialog (1.29, F-ED-23, #991): when each is on, what
// it asks, and what it changes.

afterEach(cleanup);

const SAVE = "edit.saveSharedSection";
const RENAME = "edit.renameSharedSection";
const DETACH = "edit.detachSharedSection";
const DELETE = "edit.deleteSharedSection";

const site = (session: EditorSession) => session.history.document.getState();
const labels = (session: EditorSession) =>
  session.history.state.getState().entries.map((entry) => entry.label);
const sharedIds = (session: EditorSession) => Object.keys(site(session).sharedSections);

/** The starter site with its first section selected, and the commands registered on it. */
function setUp(siteWide?: { confirmSiteWide: () => Promise<boolean> }) {
  const session = sessionWith(starterSite());
  session.select("section-1");
  const { commands } = registriesForTest();
  const askName = vi.fn();
  const beforeAction = vi.fn();
  const registered = registerSharedSectionCommands(
    commands,
    session,
    beforeAction,
    askName,
    siteWide,
  );
  const enabled = (id: string) => commands.get(id)?.enabled;
  return { session, commands, askName, beforeAction, registered, enabled };
}

/** Saves the selected section as shared section "Hours", which selects it in its copy. */
function saveAndSelectCopy(session: EditorSession) {
  saveAsSharedSection(session, "Hours");
  const { pageId, nodeId } = session.ui.getState();
  return copySelection(site(session), pageId, nodeId);
}

describe("the shared-section commands (1.29, F-ED-23)", () => {
  it("offers Save for a section of the page, and the others for a copy", () => {
    const { session, enabled } = setUp();

    expect(enabled(SAVE)).toBe(true);
    expect([enabled(RENAME), enabled(DETACH), enabled(DELETE)]).toEqual([false, false, false]);

    const selected = saveAndSelectCopy(session);
    expect(selected).toBeDefined();
    expect(enabled(SAVE)).toBe(false);
    expect([enabled(RENAME), enabled(DETACH), enabled(DELETE)]).toEqual([true, true, true]);
  });

  it("turns them all off while the layout is locked, or several elements are selected", () => {
    const { session, registered, enabled } = setUp();

    registered.setLayoutLocked(true);
    expect(enabled(SAVE)).toBe(false);
    registered.setLayoutLocked(false);
    expect(enabled(SAVE)).toBe(true);
    // Another element selected too (1.31).
    session.toggleSelected("heading-1");
    expect(enabled(SAVE)).toBe(false);
  });

  it("asks for a name to save under, the section's own, and for one to rename to", () => {
    const { session, commands, askName, beforeAction } = setUp();

    commands.run(SAVE);
    expect(beforeAction).toHaveBeenCalledOnce();
    expect(askName).toHaveBeenLastCalledWith({ kind: "save", suggested: expect.any(String) });

    const selected = saveAndSelectCopy(session);
    commands.run(RENAME);
    expect(askName).toHaveBeenLastCalledWith({
      kind: "rename",
      id: selected?.shared.id,
      suggested: "Hours",
    });
  });

  it("detaches a copy, leaving the shared section, as one step", () => {
    const { session, commands } = setUp();
    saveAndSelectCopy(session);

    commands.run(DETACH);

    expect(sharedIds(session)).toHaveLength(1);
    const { pageId } = session.ui.getState();
    expect(copySelection(site(session), pageId, session.ui.getState().nodeId)).toBeUndefined();
    expect(labels(session)).toHaveLength(2);
  });

  it("asks before deleting a shared section a page has a copy of, and deletes only on yes (D7)", async () => {
    const confirmSiteWide = vi.fn(async () => false);
    const { session, commands } = setUp({ confirmSiteWide });
    saveAndSelectCopy(session);

    commands.run(DELETE);
    await vi.waitFor(() => expect(confirmSiteWide).toHaveBeenCalledOnce());
    expect(confirmSiteWide).toHaveBeenCalledWith(expect.objectContaining({ affectedPages: 1 }));
    expect(sharedIds(session)).toHaveLength(1);

    confirmSiteWide.mockResolvedValueOnce(true);
    commands.run(DELETE);
    await vi.waitFor(() => expect(sharedIds(session)).toEqual([]));
  });

  it("deletes one no page has a copy of without asking, and nothing for one that's gone", () => {
    const confirmSiteWide = vi.fn(async () => true);
    const { session, commands } = setUp({ confirmSiteWide });
    const selected = saveAndSelectCopy(session);
    if (selected === undefined) throw new Error("no copy");
    const id = selected.shared.id;
    // Its only copy detached: no page has one now.
    commands.run(DETACH);

    removeSharedSection(session, id, { confirmSiteWide });

    expect(confirmSiteWide).not.toHaveBeenCalled();
    expect(sharedIds(session)).toEqual([]);
    const steps = labels(session).length;
    removeSharedSection(session, id, { confirmSiteWide });
    expect(labels(session).length).toBe(steps);
  });

  it("removes its commands, and stops following the session", () => {
    const { session, commands, registered } = setUp();
    const update = vi.spyOn(commands, "update");

    registered.remove();
    session.select("heading-1");

    expect([SAVE, RENAME, DETACH, DELETE].map((id) => commands.get(id))).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("the shared section's name dialog (F-ED-23)", () => {
  it("saves the selected section under the name given, as one step", async () => {
    const session = sessionWith(starterSite());
    session.select("section-1");
    const onClose = vi.fn();
    render(
      <SharedSectionNameDialog
        session={session}
        naming={{ kind: "save", suggested: "Welcome" }}
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: t("canvas.saveSharedSection.confirm") }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(Object.values(site(session).sharedSections).map((each) => each.name)).toEqual([
      "Welcome",
    ]);
  });

  it("renames a shared section, refusing a name another has", async () => {
    // A page with a second section, saved as another shared section, "Contact".
    const start = starterSite();
    start.pages[start.homePageId]?.doc.content.push({
      type: "Section",
      props: { id: "section-2" },
    });
    const session = sessionWith(start);
    session.select("section-2");
    saveAsSharedSection(session, "Contact");
    session.select("section-1");
    const selected = saveAndSelectCopy(session);
    if (selected === undefined) throw new Error("no copy");
    expect(sharedIds(session)).toHaveLength(2);
    const onClose = vi.fn();
    render(
      <SharedSectionNameDialog
        session={session}
        naming={{ kind: "rename", id: selected.shared.id, suggested: "Hours" }}
        onClose={onClose}
      />,
    );
    const field = screen.getByRole("textbox");
    const confirm = () =>
      userEvent.click(
        screen.getByRole("button", { name: t("canvas.renameSharedSection.confirm") }),
      );

    await userEvent.clear(field);
    await userEvent.type(field, "Contact");
    await confirm();
    expect(onClose).not.toHaveBeenCalled();
    expect(site(session).sharedSections[selected.shared.id]?.name).toBe("Hours");

    await userEvent.clear(field);
    await userEvent.type(field, "Opening hours");
    await confirm();

    expect(site(session).sharedSections[selected.shared.id]?.name).toBe("Opening hours");
  });
});
