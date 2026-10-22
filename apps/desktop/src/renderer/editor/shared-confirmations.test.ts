import {
  copiedNodeId,
  type NodeDoc,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import { connectEngine, createEditorSession, currentPage } from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { confirmSharedRemovals, sharedCutConfirmation } from "./shared-confirmations.js";
import { starterSite } from "./starter-site.js";

/** The starter site, its shared Footer holding two Headings beside the Footer itself. */
function footerSite(): SiteDoc {
  const site = starterSite();
  site.layout.footer.push(
    { type: "Heading", props: { id: "fh", text: "Hours" } },
    { type: "Heading", props: { id: "fh2", text: "Open daily" } },
  );
  return site;
}

/**
 * A session on `site`. `answer` settles the question when it is asked; without one, the test
 * answers it with `settle`.
 */
function setUp(answer?: boolean, site: SiteDoc = footerSite()) {
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
      sharedCutConfirmation(session, { confirmSiteWide })("Heading", { region: "footer" }),
    ).resolves.toBe(false);
    expect(confirmSiteWide).toHaveBeenCalledWith({
      action: "Cut Heading from the shared Footer?",
      confirm: "Cut",
      affectedPages: 2,
    });
  });
});

const HOURS = "shared-hours" as SharedSectionId;

/**
 * A site with a shared section, "Opening hours" (a Section holding two Headings), with a copy on
 * the home page and another on a second page.
 */
function copiesSite(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({ type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } });
  const about = "page-about" as PageId;
  site.pages[about] = {
    ...structuredClone(home),
    id: about,
    slug: "about",
    title: "About",
    doc: {
      root: { props: {} },
      content: [{ type: SHARED_COPY_TYPE, props: { id: "c9", sharedSectionId: HOURS } }],
    },
  };
  site.pageOrder.push(about);
  return {
    ...site,
    sharedSections: {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: {
          type: "Section",
          props: {
            id: "s",
            content: [
              { type: "Heading", props: { id: "t", text: "Hours" } },
              { type: "Heading", props: { id: "u", text: "Open daily" } },
            ],
          },
        },
      },
    },
  };
}

describe("deleting inside a linked copy (F-ED-23, D7)", () => {
  /** The shared section's elements, as the document has them. */
  const inSection = (session: ReturnType<typeof setUp>["session"]) =>
    (
      session.history.document.getState().sharedSections[HOURS]?.section.props.content as
        | NodeDoc[]
        | undefined
    )?.map((node) => node.props);
  /** The canvas deleting copy c1's first Heading, as the engine reports it. */
  const removeInCopy = ({ session, engine }: ReturnType<typeof setUp>) => {
    const site = session.history.document.getState();
    const page = currentPage(session)?.doc;
    const section = site.sharedSections[HOURS]?.section;
    if (page === undefined || section === undefined) throw new Error("no page");
    const content = (section.props.content as NodeDoc[]).filter((node) => node.props.id !== "t");
    engine.edit({
      kind: "remove",
      nodeId: copiedNodeId("c1", "t"),
      componentType: "Heading",
      page,
      selection: null,
      sharedSection: { id: HOURS, section: { ...section, props: { ...section.props, content } } },
    });
  };

  it("asks with how many copies and pages change, then removes it from every copy", async () => {
    const ctx = setUp(undefined, copiesSite());
    // Another element of the section edited meanwhile stays edited.
    removeInCopy(ctx);
    ctx.session.edit("text", "Edited", (draft) => {
      const content = draft.sharedSections[HOURS]?.section.props.content as NodeDoc[] | undefined;
      const open = content?.find((node) => node.props.id === "u");
      if (open !== undefined) open.props.text = "Open on Sundays";
    });
    expect(ctx.confirmSiteWide).toHaveBeenCalledWith({
      action: "Delete Heading from the shared section 'Opening hours'?",
      description: "All 2 copies of the section show the change.",
      confirm: "Delete",
      affectedPages: 2,
    });
    ctx.settle(true);

    await vi.waitFor(() =>
      expect(ctx.labels()).toEqual(["Edited", "Edited shared section 'Opening hours'"]),
    );
    expect(inSection(ctx.session)).toEqual([{ id: "u", text: "Open on Sundays" }]);
  });

  it("puts every copy back on the canvas, recording nothing, when cancelled", async () => {
    const ctx = setUp(false, copiesSite());

    removeInCopy(ctx);

    await vi.waitFor(() => expect(ctx.engine.applyChange).toHaveBeenCalled());
    expect(vi.mocked(ctx.engine.applyChange).mock.lastCall?.[0].shared).toBe(
      ctx.session.history.document.getState().sharedSections,
    );
    expect(ctx.labels()).toEqual([]);
    expect(inSection(ctx.session)?.map((props) => props.id)).toEqual(["t", "u"]);
  });

  /** The home page's own ids, a copy by its own id. */
  const pageIds = (session: ReturnType<typeof setUp>["session"]) =>
    currentPage(session)?.doc.content.map((node) => node.props.id);

  // The quick bar, the Delete key, the Edit menu and Layers all have the engine remove the copy's
  // section; the engine reports that as a page edit (puck-engine.test.tsx, "deletes a copy as a
  // whole"). Either way, it goes from this page only, without the site-wide question.
  it("deletes a whole copy from this page only, without asking, as the engine reports it", async () => {
    const ctx = setUp(undefined, copiesSite());
    const page = currentPage(ctx.session)?.doc;
    if (page === undefined) throw new Error("no page");
    const shared = ctx.session.history.document.getState().sharedSections[HOURS];

    ctx.engine.edit({
      kind: "remove",
      nodeId: copiedNodeId("c1", "s"),
      componentType: "Section",
      page: { ...page, content: page.content.filter((node) => node.props.id !== "c1") },
      selection: null,
    });

    expect(ctx.confirmSiteWide).not.toHaveBeenCalled();
    expect(ctx.labels()).toEqual(["Deleted Section"]);
    expect(pageIds(ctx.session)).not.toContain("c1");
    expect(ctx.session.history.document.getState().sharedSections[HOURS]).toBe(shared);
  });

  it("deletes a whole copy from this page only, even reported as a shared-section edit", () => {
    const ctx = setUp(undefined, copiesSite());
    const site = ctx.session.history.document.getState();
    const page = currentPage(ctx.session)?.doc;
    const shared = site.sharedSections[HOURS];
    if (page === undefined || shared === undefined) throw new Error("no page");

    ctx.engine.edit({
      kind: "remove",
      nodeId: copiedNodeId("c1", "s"),
      componentType: "Section",
      page,
      selection: null,
      sharedSection: { id: HOURS, section: shared.section },
    });

    expect(ctx.confirmSiteWide).not.toHaveBeenCalled();
    expect(ctx.labels()).toEqual(["Deleted Section"]);
    expect(pageIds(ctx.session)).not.toContain("c1");
    expect(ctx.session.history.document.getState().sharedSections[HOURS]).toBe(shared);
    ctx.session.history.undo();
    expect(pageIds(ctx.session)).toContain("c1");
  });

  it("asks before Cut takes an element from a shared section, saying when it has one copy", async () => {
    const site = copiesSite();
    delete site.pages["page-about" as PageId];
    const { session, confirmSiteWide } = setUp(false, site);

    await expect(
      sharedCutConfirmation(session, { confirmSiteWide })("Heading", { sharedSection: HOURS }),
    ).resolves.toBe(false);
    expect(confirmSiteWide).toHaveBeenCalledWith({
      action: "Cut Heading from the shared section 'Opening hours'?",
      description: "The section's 1 copy shows the change.",
      confirm: "Cut",
      affectedPages: 1,
    });
  });
});
