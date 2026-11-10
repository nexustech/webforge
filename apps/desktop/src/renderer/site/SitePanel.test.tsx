// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { createPanelRegistry } from "../shell/panels.js";
import { sessionWith } from "../testing/fixtures.js";
import { pagesPanelActions, registerSitePanel } from "./SitePanel.js";

afterEach(cleanup);

describe("Site panel", () => {
  it("shows the session's pages in the right column's bottom and follows its changes", async () => {
    const session = sessionWith();
    const panels = createPanelRegistry();
    const remove = registerSitePanel(panels, session);
    const panel = panels.list()[0];
    expect(panel).toMatchObject({ id: "site", slot: "right.bottom", title: "Site" });
    if (panel === undefined) throw new Error("not registered");
    const SitePanel = panel.component;
    render(<SitePanel />);
    // The page list, not the Menu under it, which lists the pages too.
    const pages = () => within(screen.getByRole("list", { name: "Pages" }));

    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Blank Page…" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));

    const added = pages().getByRole("button", { name: /^New page/ });
    expect(added.getAttribute("aria-current")).toBe("page");
    // Content edits leave the list as it is.
    act(() => {
      session.edit("props", "Edited page", (draft) => {
        const page = draft.pages[session.ui.getState().pageId];
        if (page !== undefined) page.doc.root.props = { title: "Changed" };
      });
    });
    expect(pages().getByRole("button", { name: /^New page/ })).toBe(added);
    act(() => {
      session.history.undo();
      session.history.undo();
    });
    expect(pages().queryByRole("button", { name: /^New page/ })).toBeNull();

    remove();
    expect(panels.list()).toEqual([]);
  });

  it("offers the cookie policy as soon as Google Analytics is turned on (#866)", async () => {
    const session = sessionWith();
    const panels = createPanelRegistry();
    registerSitePanel(panels, session);
    const SitePanel = panels.list()[0]?.component;
    if (SitePanel === undefined) throw new Error("not registered");
    render(<SitePanel />);

    act(() => {
      session.edit("props", "Changed Site Settings", (draft) => {
        draft.settings.analytics.measurementId = "G-ABC123DEF4";
      });
    });
    await userEvent.click(screen.getByRole("button", { name: "Add Page" }));

    expect(screen.getByRole("menuitem", { name: "Cookie Policy Page" })).toBeTruthy();
  });

  it("keeps a page's old address once the site has been published (#862)", async () => {
    const session = sessionWith();
    const publishedYear = createStore<number | undefined>(() => undefined);
    const panels = createPanelRegistry();
    registerSitePanel(panels, session, undefined, publishedYear);
    const SitePanel = panels.list()[0]?.component;
    if (SitePanel === undefined) throw new Error("not registered");
    render(<SitePanel />);
    const actions = pagesPanelActions(
      session,
      undefined,
      () => publishedYear.getState() !== undefined,
    );
    act(() => actions.add("About"));
    const about = session.ui.getState().pageId;
    const kept = () => session.history.document.getState().settings.search.keptAddresses;

    act(() => actions.moveToFolder(about, "Info"));
    expect(kept()).toBeUndefined();

    act(() => publishedYear.setState(2026, true));
    act(() => actions.moveToFolder(about, undefined));
    expect(kept()).toEqual([{ from: "info/about.html", page: about }]);

    // The rename dialog starts with it on.
    const pages = within(screen.getByRole("list", { name: "Pages" }));
    await userEvent.click(pages.getByRole("button", { name: "Actions for About" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    await screen.findByRole("textbox", { name: "Page name" });
    await userEvent.keyboard("Our story");
    expect(screen.getByRole("checkbox", { name: "Keep the old address working" })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("asks before deleting a page, saying how many pages it changes (D7)", async () => {
    const session = sessionWith();
    const answers = [false, true];
    const confirmSiteWide = vi.fn(async () => answers.shift() ?? false);
    const actions = pagesPanelActions(session, { confirmSiteWide });
    actions.add("About");
    const about = session.ui.getState().pageId;
    const pages = () => Object.keys(session.history.document.getState().pages);

    actions.remove(about);
    await vi.waitFor(() => expect(confirmSiteWide).toHaveBeenCalledOnce());
    expect(pages()).toContain(about);
    actions.remove(about);
    await vi.waitFor(() => expect(pages()).not.toContain(about));

    // It is in the menu that every page shows: all 3 pages change.
    expect(confirmSiteWide).toHaveBeenLastCalledWith({
      action: "Delete page 'About'?",
      description: "This removes the page and its content.",
      confirm: "Delete Page",
      affectedPages: 3,
    });
    expect(session.history.entries().at(-1)?.label).toBe("Deleted page 'About'");
  });

  it("binds every action to the session as one undo step", () => {
    const session = sessionWith();
    const actions = pagesPanelActions(session);
    const site = () => session.history.document.getState();
    const home = site().homePageId;

    actions.add("About");
    const about = session.ui.getState().pageId;
    actions.show(home);
    expect(session.ui.getState().pageId).toBe(home);
    actions.rename(about, "Company", false);
    actions.duplicate(about);
    actions.move(about, -1);
    actions.moveToFolder(about, "Info");
    actions.setHidden(about, true);
    actions.setHome(about);
    actions.remove(home);

    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Added page 'About'",
      "Renamed page 'Company'",
      "Duplicated page 'Company'",
      "Moved page 'Company'",
      "Moved page 'Company'",
      "Hid 'Company' from navigation",
      "Set 'Company' as Home page",
      "Deleted page 'My site'",
    ]);
  });
});
