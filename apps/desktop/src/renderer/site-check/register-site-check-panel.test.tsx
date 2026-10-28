// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  type NodeDoc,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { createPanelRegistry, panelsInSlot } from "../shell/panels.js";
import { sessionWith } from "../testing/fixtures.js";
import { registerSiteCheckPanel, SITE_CHECK_PANEL_ID } from "./register-site-check-panel.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * Site Check's recheck driven by the test rather than the clock (#552): the pause after a change on
 * fake timers, and every rule in one idle period, so a busy machine can't make it late. Returns
 * `recheck`, which runs the recheck a change has scheduled. Clicks are `fireEvent`'s then, as
 * user-event's wait on the timers.
 */
function driveRecheck() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("requestIdleCallback", (work: IdleRequestCallback) => {
    work({ didTimeout: false, timeRemaining: () => Number.POSITIVE_INFINITY });
    return 0;
  });
  return {
    recheck: () =>
      act(() => {
        vi.runOnlyPendingTimers();
      }),
  };
}

const ABOUT = "page-about" as PageId;

/** A site with an About page at `slug` in `folder`, holding `content`. */
function siteWith({
  slug = "about",
  folder,
  title = "About",
  content = [],
}: {
  slug?: string;
  folder?: string;
  title?: string;
  content?: NodeDoc[];
} = {}): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...site,
    settings: { ...site.settings, address: { url: "https://bakery.example" } },
    pages: {
      ...site.pages,
      [ABOUT]: {
        ...home,
        id: ABOUT,
        slug,
        title,
        ...(folder === undefined ? {} : { folder }),
        doc: { root: { props: {} }, content },
      },
    },
    pageOrder: [...site.pageOrder, ABOUT],
  };
}

function setUp(site: SiteDoc = siteWith(), ignored: readonly string[] = []) {
  const session = sessionWith(site);
  const panels = createPanelRegistry();
  const settings = createSettingsRegistry();
  const showSettings = vi.spyOn(settings, "show").mockResolvedValue(true);
  const showPanel = vi.spyOn(panels, "show");
  const saveIgnored = vi.fn();
  const commands = { run: vi.fn(() => true) };
  const openGuide = vi.fn();
  const remove = registerSiteCheckPanel(panels, {
    session,
    settings,
    commands,
    openGuide,
    ignored,
    saveIgnored,
  });
  const panel = panels.list()[0];
  if (panel === undefined) throw new Error("not registered");
  const SiteCheck = panel.component;
  render(<SiteCheck />);
  const rule = (id: string) => {
    const row = document.querySelector<HTMLElement>(`[data-rule="${id}"]`);
    if (row === null) throw new Error(`no rule ${id}`);
    return row;
  };
  return {
    session,
    panels,
    remove,
    saveIgnored,
    showSettings,
    showPanel,
    commands,
    openGuide,
    rule,
  };
}

describe("registerSiteCheckPanel (3.6, F-CHK-1)", () => {
  it("is in the bottom drawer in Simple mode, under Must fix, Should fix and Tips", () => {
    const { panels, remove, rule } = setUp();

    expect(panelsInSlot(panels.list(), "drawer", "simple").map((panel) => panel.id)).toEqual([
      SITE_CHECK_PANEL_ID,
    ]);
    expect(screen.getByRole("heading", { name: "Must fix" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Should fix" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Tips" })).toBeDefined();
    // A green dot and its verdict for a rule that passes (SP-13).
    expect(rule("brokenLinks").dataset.status).toBe("pass");
    expect(rule("brokenLinks").textContent).toContain("Every link goes somewhere");

    remove();
    expect(panels.list()).toEqual([]);
  });

  it("fixes a page Windows can't save, as one undo step, and the dot turns green (R16)", () => {
    const { recheck } = driveRecheck();
    const { session, rule } = setUp(siteWith({ slug: "con", folder: "aux/shop" }));
    expect(rule("deviceNames").dataset.status).toBe("fail");
    expect(screen.getByRole("status").textContent).toMatch(/^1 must fix · /);
    // Must fix can't be ignored.
    expect(within(rule("deviceNames")).queryByRole("button", { name: /Ignore/ })).toBeNull();

    fireEvent.click(within(rule("deviceNames")).getByRole("button", { name: "Fix" }));

    const about = session.history.document.getState().pages[ABOUT];
    expect([about?.folder, about?.slug]).toEqual(["aux-2/shop", "con-2"]);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Renamed the file of page 'About'",
    ]);
    recheck();
    expect(rule("deviceNames").dataset.status).toBe("pass");
  });

  it("moves every page in a device-named folder together, deeper ones too", () => {
    const { recheck } = driveRecheck();
    const site = siteWith({ slug: "hours", folder: "aux/shop" });
    const about = site.pages[ABOUT];
    if (about === undefined) throw new Error("no About page");
    const cakes = { ...about, id: "page-cakes" as PageId, slug: "cakes", folder: "aux" };
    const taken = { ...about, id: "page-taken" as PageId, slug: "old", folder: "aux-2" };
    const { session, rule } = setUp({
      ...site,
      pages: { ...site.pages, [cakes.id]: cakes, [taken.id]: taken },
      pageOrder: [...site.pageOrder, cakes.id, taken.id],
    });

    const [first] = within(rule("deviceNames")).getAllByRole("button", { name: "Fix" });
    if (first === undefined) throw new Error("no Fix");
    fireEvent.click(first);

    const pages = session.history.document.getState().pages;
    expect([pages[ABOUT]?.folder, pages[cakes.id]?.folder, pages[taken.id]?.folder]).toEqual([
      "aux-3/shop",
      "aux-3",
      "aux-2",
    ]);
    recheck();
    expect(rule("deviceNames").dataset.status).toBe("pass");
  });

  it("gives a page without a title the text of its first heading", async () => {
    const heading = { type: "Heading", props: { id: "h", text: "Our story" } };
    const { session, rule } = setUp(siteWith({ title: "", content: [heading] }));
    expect(rule("pageTitles").textContent).toContain("Untitled page (about.html)");

    await userEvent.click(within(rule("pageTitles")).getByRole("button", { name: "Fix" }));

    expect(session.history.document.getState().pages[ABOUT]?.title).toBe("Our story");
  });

  it("jumps to an element on its page, and opens Site Settings at the web address", async () => {
    const gone = { kind: "page", pageId: "page-gone" };
    const site = siteWith({
      content: [{ type: "Button", props: { id: "b", label: "Go", link: gone } }],
    });
    const { session, rule, showSettings } = setUp({
      ...site,
      settings: { ...site.settings, address: {} },
    });

    await userEvent.click(
      within(rule("brokenLinks")).getByRole("button", { name: "Show Button on About" }),
    );
    expect([session.ui.getState().pageId, session.ui.getState().nodeId]).toEqual([ABOUT, "b"]);

    await userEvent.click(within(rule("webAddress")).getByRole("button", { name: "Fix" }));
    expect(showSettings).toHaveBeenCalledWith("site", "address");
  });

  it("opens Site Settings at Forms for a form with no service; a Newsletter's address is its own (3.7)", async () => {
    const site = siteWith({
      content: [
        { type: "ContactForm", props: { id: "write" } },
        { type: "Newsletter", props: { id: "news" } },
      ],
    });
    const { rule, showSettings } = setUp(site);
    expect(rule("forms").textContent).toContain("2 forms have nowhere to send their messages");

    // Only the Contact form's line has a Fix: the Newsletter's is to select it.
    const [fix, ...others] = within(rule("forms")).getAllByRole("button", { name: "Fix" });
    expect(others).toEqual([]);
    if (fix === undefined) throw new Error("no Fix");
    await userEvent.click(fix);

    expect(showSettings).toHaveBeenCalledWith("site", "forms");
  });

  it("stops the export for a file from another website, shown in Settings' Custom Code (3.9)", async () => {
    const site = siteWith({ content: [] });
    const { rule, showSettings } = setUp({
      ...site,
      code: { ...site.code, css: ".hero { background: url(https://img.example.com/hero.jpg); }" },
    });
    expect(rule("externalResources").textContent).toContain("https://img.example.com/hero.jpg");

    await userEvent.click(
      within(rule("externalResources")).getByRole("button", {
        name: "Show Custom Code › Stylesheet",
      }),
    );
    expect(showSettings).toHaveBeenCalledWith("code", "code");
  });

  it("jumps to a shared section's element in a page's copy of it (F-ED-23)", async () => {
    const HOURS = "shared-hours" as SharedSectionId;
    const site = siteWith({
      content: [{ type: SHARED_COPY_TYPE, props: { id: "copy", sharedSectionId: HOURS } }],
    });
    const { session, rule } = setUp({
      ...site,
      sharedSections: {
        [HOURS]: {
          id: HOURS,
          name: "Hours",
          section: {
            type: "Section",
            props: {
              id: "s",
              content: [{ type: "Text", props: { id: "t", text: "<p><u>Late</u></p>" } }],
            },
          },
        },
      },
    });

    await userEvent.click(
      within(rule("underlinedText")).getByRole("button", {
        name: "Show Text in the shared section Hours",
      }),
    );

    expect(session.ui.getState().pageId).toBe(ABOUT);
    expect(session.ui.getState().nodeId).toContain("t");
  });

  it("ignores a finding for the site, and brings it back", async () => {
    const underlined = { type: "Text", props: { id: "t", text: "<p><u>Late</u></p>" } };
    const { rule, saveIgnored } = setUp(siteWith({ content: [underlined] }));

    await userEvent.click(within(rule("underlinedText")).getByRole("button", { name: /^Ignore/ }));

    expect(saveIgnored).toHaveBeenLastCalledWith([`underlinedText:${ABOUT}/t`]);
    expect(rule("underlinedText").dataset.status).toBe("pass");
    await userEvent.click(screen.getByRole("button", { name: "Show 1 ignored item again" }));
    expect(saveIgnored).toHaveBeenLastCalledWith([]);
    expect(rule("underlinedText").dataset.status).toBe("warn");
  });

  it("starts from what was ignored before, and checks the site again as it changes", () => {
    const { recheck } = driveRecheck();
    const underlined = { type: "Text", props: { id: "t", text: "<p><u>Late</u></p>" } };
    const { session, rule } = setUp(siteWith({ content: [underlined] }), [
      `underlinedText:${ABOUT}/t`,
    ]);
    expect(rule("underlinedText").dataset.status).toBe("pass");

    act(() => {
      session.edit("props", "Renamed", (draft) => {
        const about = draft.pages[ABOUT];
        if (about !== undefined) about.slug = "nul";
      });
    });

    recheck();
    expect(rule("deviceNames").dataset.status).toBe("fail");
  });

  it("lists Being found after the levels, each rule with its level (3.17)", () => {
    const { rule } = setUp();

    const found = screen.getByRole("region", { name: "Being found" });
    expect(
      within(found).getByText("What helps people find your site with a search engine."),
    ).toBeDefined();
    expect(found.contains(rule("webAddress"))).toBe(true);
    expect(within(rule("pageDescriptions")).getByText("Should fix")).toBeDefined();
    expect(within(rule("mainHeading")).getByText("Tip")).toBeDefined();
    // Not under the levels as well.
    const tips = screen.getByRole("region", { name: "Tips" });
    expect(tips.contains(rule("mainHeading"))).toBe(false);
  });

  it("opens Page Settings on a page without a description (3.17)", async () => {
    const { session, commands, rule } = setUp();

    const line = within(rule("pageDescriptions")).getByRole("button", { name: "Show About" });
    const finding = line.closest("li");
    if (finding === null) throw new Error("no finding");
    await userEvent.click(within(finding).getByRole("button", { name: "Fix" }));

    expect(session.ui.getState().pageId).toBe(ABOUT);
    expect(commands.run).toHaveBeenCalledWith("page.settings");
  });

  it("opens Site Settings at Contact for a missing business detail (3.17)", async () => {
    const site = siteWith();
    const { rule, showSettings } = setUp({
      ...site,
      settings: {
        ...site.settings,
        general: { ...site.settings.general, businessType: "food" },
        contact: { ...site.settings.contact, phone: undefined },
      },
    });

    await userEvent.click(
      within(rule("businessDetails")).getByRole("button", {
        name: "Show Site Settings › Phone number",
      }),
    );
    expect(showSettings).toHaveBeenCalledWith("site", "contact");
  });

  it("opens a guide's page, and keeps a one-time tip done once marked Done (3.17)", async () => {
    const { rule, openGuide, saveIgnored } = setUp();

    await userEvent.click(
      within(rule("businessProfile")).getByRole("button", { name: "Open Google Business Profile" }),
    );
    expect(openGuide).toHaveBeenCalledWith("businessProfile");

    await userEvent.click(
      within(rule("businessProfile")).getByRole("button", {
        name: "Done: Open Google Business Profile",
      }),
    );
    expect(saveIgnored).toHaveBeenLastCalledWith(["businessProfile:businessProfile"]);
    expect(document.querySelector('[data-rule="businessProfile"]')).toBeNull();
    // Done isn't ignoring: nothing to bring back.
    expect(screen.queryByRole("button", { name: /ignored/ })).toBeNull();

    // Bringing back what was ignored leaves it done.
    await userEvent.click(
      within(rule("pageDescriptions")).getByRole("button", { name: "Ignore: About" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Show 1 ignored item again" }));
    expect(saveIgnored).toHaveBeenLastCalledWith(["businessProfile:businessProfile"]);
    expect(document.querySelector('[data-rule="businessProfile"]')).toBeNull();
  });

  it("opens the Theme panel for a colour pair", async () => {
    const site = siteWith();
    const { rule, showPanel } = setUp({
      ...site,
      theme: {
        ...site.theme,
        colors: { ...site.theme.colors, "base-content": { l: 0.95, c: 0, h: 0 } },
      },
    });

    const [first] = within(rule("contrast")).getAllByRole("button", { name: /^Show Text on/ });
    if (first === undefined) throw new Error("no contrast finding");
    await userEvent.click(first);

    expect(showPanel).toHaveBeenCalledWith("theme");
  });
});
