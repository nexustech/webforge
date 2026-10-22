import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { connectEngine, createEditorSession, currentPage } from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { confirmSharedRemovals, sharedCutConfirmation } from "./shared-confirmations.js";
import { starterSite } from "./starter-site.js";

/** A session whose shared Footer holds a Heading beside the Footer itself. */
function setUp(answer: boolean) {
  const site = starterSite();
  site.layout.footer.push({ type: "Heading", props: { id: "fh", text: "Hours" } });
  const session = createEditorSession(siteLibrary, site);
  const engine = createFakeEngine();
  const confirmSiteWide = vi.fn(async () => answer);
  connectEngine(confirmSharedRemovals(engine, session, { confirmSiteWide }), session);
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
  const footerIds = () => session.history.document.getState().layout.footer.map((n) => n.props.id);
  return { session, engine, confirmSiteWide, removeHeading, labels, footerIds };
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
    expect(footerIds()).toEqual(["footer"]);
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
            ],
          }),
        }),
      ),
    );
    expect(labels()).toEqual([]);
    expect(footerIds()).toEqual(["footer", "fh"]);
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
