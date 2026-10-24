import { describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "../shell/commands.js";
import { sessionWith } from "../testing/fixtures.js";
import { addPage, renamePage } from "./page-actions.js";
import { registerPageCommands } from "./page-commands.js";

function setUp() {
  const session = sessionWith();
  const registry = createCommandRegistry();
  const stop = registerPageCommands(registry, session);
  const pages = () =>
    registry
      .list()
      .filter((command) => command.palette === "pages")
      .map((command) => [command.label, command.keywords]);
  return { session, registry, stop, pages };
}

describe("registerPageCommands (UX-11)", () => {
  it("offers every page by its title, found by its file name too, in the site's order", () => {
    const { session, pages } = setUp();
    const site = session.history.document.getState();

    expect(pages()).toEqual(
      site.pageOrder.map((id) => [site.pages[id]?.title, [site.pages[id]?.slug]]),
    );
  });

  it("shows the page, without an undo step", () => {
    const { session, registry } = setUp();
    const about = addPage(session, "About");
    if (about === null) throw new Error("not added");
    session.showPage(session.history.document.getState().homePageId);
    const steps = session.history.entries().length;

    expect(registry.run(`page.goto.${about}`)).toBe(true);

    expect(session.ui.getState().pageId).toBe(about);
    expect(session.history.entries()).toHaveLength(steps);
  });

  it("follows pages added and renamed, but not other edits, and stops when asked", () => {
    const { session, registry, stop, pages } = setUp();
    const register = vi.spyOn(registry, "register");

    const about = addPage(session, "About");
    if (about === null) throw new Error("not added");
    expect(pages().map(([label]) => label)).toContain("About");
    renamePage(session, about, "Our story");
    expect(pages().map(([label]) => label)).toContain("Our story");
    const registered = register.mock.calls.length;
    session.edit("props", "Edited menu", (draft) => {
      draft.menu = { follows: "custom", items: [] };
    });
    expect(register.mock.calls.length).toBe(registered);

    stop();
    expect(pages()).toEqual([]);
  });
});
