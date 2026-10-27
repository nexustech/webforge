// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import { createSettingsRegistry } from "../settings/index.js";
import { createPanelRegistry, panelsInSlot } from "../shell/panels.js";
import { sessionWith } from "../testing/fixtures.js";
import { registerSiteCheckPanel, SITE_CHECK_PANEL_ID } from "./register-site-check-panel.js";

afterEach(cleanup);

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
  const remove = registerSiteCheckPanel(panels, { session, settings, ignored, saveIgnored });
  const panel = panels.list()[0];
  if (panel === undefined) throw new Error("not registered");
  const SiteCheck = panel.component;
  render(<SiteCheck />);
  const rule = (id: string) => {
    const row = document.querySelector<HTMLElement>(`[data-rule="${id}"]`);
    if (row === null) throw new Error(`no rule ${id}`);
    return row;
  };
  return { session, panels, remove, saveIgnored, showSettings, showPanel, rule };
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

  it("fixes a page Windows can't save, as one undo step, and the dot turns green (R16)", async () => {
    const { session, rule } = setUp(siteWith({ slug: "con", folder: "aux/shop" }));
    expect(rule("deviceNames").dataset.status).toBe("fail");
    expect(screen.getByRole("status").textContent).toMatch(/^1 must fix · /);
    // Must fix can't be ignored.
    expect(within(rule("deviceNames")).queryByRole("button", { name: /Ignore/ })).toBeNull();

    await userEvent.click(within(rule("deviceNames")).getByRole("button", { name: "Fix" }));

    const about = session.history.document.getState().pages[ABOUT];
    expect([about?.folder, about?.slug]).toEqual(["aux-2/shop", "con-2"]);
    expect(session.history.entries().map((entry) => entry.label)).toEqual([
      "Renamed the file of page 'About'",
    ]);
    await waitFor(() => expect(rule("deviceNames").dataset.status).toBe("pass"));
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

  it("starts from what was ignored before, and checks the site again as it changes", async () => {
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

    await waitFor(() => expect(rule("deviceNames").dataset.status).toBe("fail"));
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
