import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import { connectEngine, createEditorSession, currentPage } from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { confirmSharedRemovals, sharedCutConfirmation } from "./shared-confirmations.js";
import { starterSite } from "./starter-site.js";

/**
 * A session whose shared Footer holds two Headings beside the Footer itself. `answer` settles the
 * question when it is asked; without one, the test answers it with `settle`.
 */
function setUp(answer?: boolean) {
  const site = starterSite();
  site.layout.footer.push(
    { type: "Heading", props: { id: "fh", text: "Hours" } },
    { type: "Heading", props: { id: "fh2", text: "Open daily" } },
  );
  const session = createEditorSession(siteLibrary, site);
  const engine = createFakeEngine();
  let settle: (confirmed: boolean) => void = () => undefined;
  let asking = false;
  const confirmSiteWide = vi.fn(
    (_action: SiteWideAction) =>
      new Promise<boolean>((resolve) => {
        asking = true;
        settle = (confirmed) => {
          asking = false;
          resolve(confirmed);
        };
        if (answer !== undefined) settle(answer);
      }),
  );
  const siteWide = { confirmSiteWide, current: () => (asking ? ({} as SiteWideAction) : null) };
  connectEngine(confirmSharedRemovals(engine, session, siteWide), session);
  const removeHeading = () => {
    const { layout } = session.history.document.getState();
    const page = currentPage(session)?.doc;
    if (page === undefined) throw new Error("no page");
    engine.edit({
      kind: "remove",
      nodeId: "fh",
      componentType: "Heading",
      page,
      selection: null,
      shared: true,
      layout: { ...layout, footer: layout.footer.filter((node) => node.props.id !== "fh") },
    });
  };
  const labels = () => session.history.entries().map((entry) => entry.label);
  const footer = () => session.history.document.getState().layout.footer.map((n) => n.props);
  const footerIds = () => footer().map((props) => props.id);
  return {
    session,
    engine,
    confirmSiteWide,
    settle: (confirmed: boolean) => settle(confirmed),
    removeHeading,
    labels,
    footer,
    footerIds,
  };
}

describe("confirmSharedRemovals (D7, F-ED-7)", () => {
  it("removes an element of the shared Footer from every page once confirmed, as one step", async () => {
    const { confirmSiteWide, removeHeading, labels, footerIds } = setUp(true);

    removeHeading();
    await vi.waitFor(() => expect(labels()).toEqual(["Deleted shared Heading"]));

    expect(confirmSiteWide).toHaveBeenCalledWith({
      action: "Delete Heading from the shared Footer?",
      confirm: "Delete",
      affectedPages: 2,
    });
    expect(footerIds()).toEqual(["footer", "fh2"]);
  });

  it("removes only the element, from the Footer as it is when confirmed", async () => {
    const { session, engine, settle, removeHeading, labels, footer } = setUp();
    session.edit("text", "Edited shared Heading text", (draft) => {
      const heading = draft.layout.footer.find((node) => node.props.id === "fh2");
      if (heading !== undefined) heading.props.text = "Closed on Mondays";
    });

    // The canvas holds the Footer with the edited text while it asks; meanwhile, undo is ignored
    // there and only the question's own answer changes anything.
    removeHeading();
    expect(engine.command("undo")).toBe(false);
    expect(labels()).toEqual(["Edited shared Heading text"]);
    // Undone some other way while asking, the edit stays undone after the removal.
    session.history.undo();
    settle(true);

    await vi.waitFor(() => expect(labels()).toEqual(["Deleted shared Heading"]));
    expect(footer()).toEqual([
      expect.objectContaining({ id: "footer" }),
      { id: "fh2", text: "Open daily" },
    ]);
    expect(engine.command("undo")).toBe(true);
    expect(footer().map((props) => props.id)).toEqual(["footer", "fh", "fh2"]);
  });

  it("puts the canvas back, recording nothing, when cancelled", async () => {
    const { engine, removeHeading, labels, footerIds } = setUp(false);

    removeHeading();
    await vi.waitFor(() =>
      expect(engine.applyChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          layout: expect.objectContaining({
            footer: [
              expect.anything(),
              expect.objectContaining({ props: { id: "fh", text: "Hours" } }),
              expect.anything(),
            ],
          }),
        }),
      ),
    );
    expect(labels()).toEqual([]);
    expect(footerIds()).toEqual(["footer", "fh", "fh2"]);
  });

  it("puts back only what the page shows when cancelled, not a Header it hides", async () => {
    const { session, engine, removeHeading } = setUp(false);
    session.edit("props", "Hid the Header", (draft) => {
      const page = draft.pages[draft.homePageId];
      if (page !== undefined) page.settings.hideHeader = true;
    });
    const applyChange = vi.mocked(engine.applyChange);
    applyChange.mockClear();

    removeHeading();
    await vi.waitFor(() => expect(applyChange).toHaveBeenCalled());
    const layout = applyChange.mock.lastCall?.[0].layout;
    expect(layout?.header).toEqual([]);
    expect(layout?.footer.map((node) => node.props.id)).toEqual(["footer", "fh", "fh2"]);
  });

  it("lets edits of the page itself through without asking", () => {
    const { session, engine, confirmSiteWide, labels } = setUp(true);
    const page = currentPage(session)?.doc;
    if (page === undefined) throw new Error("no page");

    engine.edit({
      kind: "remove",
      nodeId: "section-1",
      componentType: "Section",
      page: { ...page, content: [] },
    });

    expect(confirmSiteWide).not.toHaveBeenCalled();
    expect(labels()).toEqual(["Deleted Section"]);
  });

  it("asks before Cut takes an element from the shared Header or Footer", async () => {
    const { session, confirmSiteWide } = setUp(false);

    await expect(
      sharedCutConfirmation(session, { confirmSiteWide })("Heading", "footer"),
    ).resolves.toBe(false);
    expect(confirmSiteWide).toHaveBeenCalledWith({
      action: "Cut Heading from the shared Footer?",
      confirm: "Cut",
      affectedPages: 2,
    });
  });
});
