import { type NodeDoc, newId, type PageId, type SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import type { EditorSession } from "../editor/editor-session.js";
import { saveAsSharedSection } from "../shared-sections/index.js";
import { createCommandRegistry } from "../shell/commands.js";
import type { SiteWideAction } from "../shell/confirm-site-wide.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  applyLook,
  applyLookToAll,
  LOOK_COMMANDS,
  lookChange,
  lookConfirmation,
  lookFieldsOf,
  registerLookCommands,
} from "./apply-look.js";

const button = (id: string, look: Readonly<Record<string, unknown>> = {}): NodeDoc => ({
  type: "Button",
  props: { id, label: "Book", link: "about", ...look },
});

const section = (id: string, content: NodeDoc[], more: Record<string, unknown> = {}): NodeDoc => ({
  type: "Section",
  props: { id, content, ...more },
});

/** The styled Button's look: a large shadow and the accent background, mobile set apart. */
const LOOK = {
  lookShadow: "large",
  lookBackground: "accent",
  lookCorners: { $responsive: { desktop: "large", mobile: "full" } },
};

/**
 * A site of two pages, Home and About: Home with the styled Button `styled`, a plain one and a
 * Heading; About with two plain Buttons, one in a hidden section. A session on Home.
 */
function setUp(edit?: (site: SiteDoc, about: PageId) => void) {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [
    section("s", [
      button("styled", LOOK),
      button("plain"),
      { type: "Heading", props: { id: "h" } },
    ]),
  ];
  const about = newId("page");
  site.pages[about] = {
    ...structuredClone(home),
    id: about,
    slug: "about",
    title: "About",
    doc: {
      root: { props: {} },
      content: [
        section("a", [button("other")]),
        section("gone", [button("hid")], { hidden: true }),
      ],
    },
  };
  site.pageOrder.push(about);
  edit?.(site, about);
  const session = sessionWith(site);
  session.select("styled");
  const props = (pageId: PageId, id: string) => {
    const find = (nodes: readonly NodeDoc[]): NodeDoc | undefined =>
      nodes
        .map((node) =>
          node.props.id === id ? node : find((node.props.content as NodeDoc[] | undefined) ?? []),
        )
        .find((node) => node !== undefined);
    return find(session.history.document.getState().pages[pageId]?.doc.content ?? [])?.props;
  };
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, home: site.homePageId, about, props, labels };
}

/** Site-wide confirmations that answer `answer`, keeping what they were asked. */
function confirmer(answer: boolean) {
  const asked: SiteWideAction[] = [];
  return {
    asked,
    confirmSiteWide: vi.fn((action: SiteWideAction) => {
      asked.push(action);
      return Promise.resolve(answer);
    }),
  };
}

const lookOf = (props: Readonly<Record<string, unknown>> | undefined) =>
  Object.fromEntries(Object.entries(props ?? {}).filter(([name]) => name.startsWith("look")));

describe("lookFieldsOf (2.27)", () => {
  it("is the Appearance group's fields, never a component's own", () => {
    const buttonDef = siteLibrary.components.Button;
    if (buttonDef === undefined) throw new Error("no Button");
    const fields = lookFieldsOf(buttonDef);
    expect(fields).toEqual(expect.arrayContaining(["lookShadow", "lookBackground", "lookSize"]));
    expect(fields).not.toContain("label");
    expect(fields.every((name) => name.startsWith("look") || name === "hover")).toBe(true);
  });
});

describe("Apply Look to Every… (2.27, ST-4)", () => {
  it("gives every Button on the site the look, after asking, as one labelled undo step", async () => {
    const { session, home, about, props, labels } = setUp();
    const siteWide = confirmer(true);

    expect(await applyLookToAll(session, "site", siteWide)).toBe(true);

    for (const [page, id] of [
      [home, "plain"],
      [about, "other"],
      [about, "hid"],
    ] as const) {
      expect(lookOf(props(page, id)), id).toEqual(LOOK);
    }
    // Its own content, and anything not a Button, as they were.
    expect(props(home, "plain")?.label).toBe("Book");
    expect(lookOf(props(home, "h"))).toEqual({});
    expect(labels()).toEqual(["Applied the Button look to 3 others"]);
    // The question said how many change, how many of them are hidden, and on how many pages.
    expect(siteWide.asked).toEqual([
      {
        action: "Give every Button on the site this look?",
        description:
          "This gives 3 other Button elements the same look. 1 of them is hidden in Layers.",
        confirm: "Apply Look",
        affectedPages: 2,
      },
    ]);

    session.history.undo();
    expect(lookOf(props(home, "plain"))).toEqual({});
    expect(lookOf(props(about, "other"))).toEqual({});
    expect(lookOf(props(home, "styled"))).toEqual(LOOK);
  });

  it("changes nothing when the question is cancelled", async () => {
    const { session, about, props, labels } = setUp();
    const before = session.history.document.getState();

    expect(await applyLookToAll(session, "site", confirmer(false))).toBe(false);

    expect(session.history.document.getState()).toBe(before);
    expect(lookOf(props(about, "other"))).toEqual({});
    expect(labels()).toEqual([]);
  });

  it("changes only the page shown for 'on this page', without asking", async () => {
    const { session, home, about, props, labels } = setUp();
    const siteWide = confirmer(true);

    expect(await applyLookToAll(session, "page", siteWide)).toBe(true);

    expect(siteWide.confirmSiteWide).not.toHaveBeenCalled();
    expect(lookOf(props(home, "plain"))).toEqual(LOOK);
    expect(lookOf(props(about, "other"))).toEqual({});
    expect(labels()).toEqual(["Applied the Button look to 1 other"]);
  });

  it("takes away a look the source doesn't have: the theme's look everywhere", async () => {
    const { session, home, about, props } = setUp((site, aboutId) => {
      const other = site.pages[aboutId]?.doc.content[0]?.props.content as NodeDoc[];
      Object.assign(other[0]?.props ?? {}, { lookItalic: true, lookShadow: "small" });
    });
    session.select("plain");

    await applyLookToAll(session, "site", confirmer(true));

    expect(lookOf(props(about, "other"))).toEqual({ lookItalic: undefined, lookShadow: undefined });
    expect(lookOf(props(home, "styled"))).toEqual({
      lookShadow: undefined,
      lookBackground: undefined,
      lookCorners: undefined,
    });
  });

  it("changes a shared section's element once, which all its copies show, asking first", async () => {
    const { session, home, labels } = setUp((site, about) => {
      const page = site.pages[about];
      if (page !== undefined) page.doc.content = [];
    });
    // The plain Button's section, saved as a shared section and placed on About too.
    session.select("s");
    const plainSection = session.history.document.getState().pages[home]?.doc.content[0];
    expect(plainSection?.props.id).toBe("s");
    saveAsSharedSection(session, "Booking");
    const [shared] = Object.values(session.history.document.getState().sharedSections);
    if (shared === undefined) throw new Error("not saved");
    const copy = session.history.document.getState().pages[home]?.doc.content[0];
    expect(copy?.props.sharedSectionId).toBe(shared.id);

    // A Button of the page's own, styled, gives its look to the plain one in the shared section;
    // the other there has it already.
    session.edit("props", "Added", (draft) => {
      draft.pages[home]?.doc.content.push(section("own", [button("mine", LOOK)]));
    });
    session.select("mine");
    const change = lookChange(session, "page");
    expect(change?.targets.map((target) => target.node.props.id)).toEqual(["plain"]);
    expect(change?.pages).toEqual([home]);

    expect(applyLook(session, change ?? never())).toBe(true);
    const after = session.history.document.getState().sharedSections[shared.id];
    const inside = (after?.section.props.content as NodeDoc[] | undefined) ?? [];
    expect(lookOf(inside.find((node) => node.props.id === "plain")?.props)).toEqual(LOOK);
    expect(labels().at(-1)).toBe("Applied the Button look to 1 other");
  });

  it("changes the shared Footer's Button there once, and asks: it is on every page", async () => {
    const { session, labels } = setUp((site) => {
      site.layout.footer = [section("foot", [button("footer-button")])];
    });
    const siteWide = confirmer(true);

    await applyLookToAll(session, "page", siteWide);

    const footer = session.history.document.getState().layout.footer;
    const inside = (footer[0]?.props.content as NodeDoc[] | undefined) ?? [];
    expect(lookOf(inside[0]?.props)).toEqual(LOOK);
    expect(siteWide.asked[0]).toMatchObject({
      action: "Give every Button on this page this look?",
      affectedPages: Object.keys(session.history.document.getState().pages).length,
    });
    expect(labels()).toEqual(["Applied the Button look to 2 others"]);
  });

  it("says so, and records nothing, when every one has the look already", async () => {
    const { session, labels } = setUp((site) => {
      const home = site.pages[site.homePageId]?.doc.content[0]?.props.content as NodeDoc[];
      Object.assign(home[1]?.props ?? {}, structuredClone(LOOK));
    });
    const notify = vi.fn();

    expect(await applyLookToAll(session, "page", confirmer(true), notify)).toBe(false);

    expect(notify).toHaveBeenCalledWith("Every Button on this page has this look already.");
    expect(labels()).toEqual([]);
  });

  it("names sections as sections in the question", () => {
    const { session } = setUp((site) => {
      Object.assign(site.pages[site.homePageId]?.doc.content[0]?.props ?? {}, LOOK);
    });
    session.select("s");
    // About's two, and the "Page not found" page's.
    const change = lookChange(session, "site");
    if (change === undefined) throw new Error("no change");
    expect(lookConfirmation(change, "site")).toEqual({
      action: "Give every Section on the site this look?",
      description:
        "This gives 3 other Section sections the same look. 1 of them is hidden in Layers.",
      confirm: "Apply Look",
      affectedPages: 2,
    });
  });
});

describe("registerLookCommands (2.27)", () => {
  function registered(session: EditorSession) {
    const registry = createCommandRegistry();
    const notify = vi.fn();
    const siteWide = confirmer(true);
    const commands = registerLookCommands(registry, session, () => undefined, siteWide, notify);
    return { registry, commands, siteWide, notify };
  }

  it("names the selected element's kind, and is off with nothing selected or in Content mode", () => {
    const { session } = setUp();
    const { registry, commands } = registered(session);

    expect(registry.get(LOOK_COMMANDS.page)).toMatchObject({
      label: "Apply Look to Every Button on This Page",
      enabled: true,
    });
    expect(registry.get(LOOK_COMMANDS.site)?.label).toBe("Apply Look to Every Button on the Site");

    session.select(null);
    expect(registry.get(LOOK_COMMANDS.site)).toMatchObject({
      label: "Apply Look to All Like It on the Site",
      enabled: false,
    });

    session.select("plain");
    commands.setLayoutLocked(true);
    expect(registry.get(LOOK_COMMANDS.page)?.enabled).toBe(false);
    registry.run(LOOK_COMMANDS.page);
    expect(session.history.entries()).toEqual([]);

    commands.remove();
    expect(registry.get(LOOK_COMMANDS.page)).toBeUndefined();
  });

  it("runs from the Edit menu", async () => {
    const { session, home, props } = setUp();
    const { registry, siteWide } = registered(session);

    registry.run(LOOK_COMMANDS.site);
    await vi.waitFor(() => expect(lookOf(props(home, "plain"))).toEqual(LOOK));
    expect(siteWide.confirmSiteWide).toHaveBeenCalledOnce();
  });
});

function never(): never {
  throw new Error("unreachable");
}
