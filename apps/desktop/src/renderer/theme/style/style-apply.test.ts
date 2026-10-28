import { type NodeDoc, newId, type PageId, type SiteDoc } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../../shared/starter-site.js";
import { COMMAND_IDS } from "../../shell/command-ids.js";
import type { SiteWideAction } from "../../shell/confirm-site-wide.js";
import { createWindowDialogs } from "../../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../../testing/fixtures.js";
import { registerStyleDialog } from "./register-style-dialog.js";
import { applyStyle, cancelStyle, openStyle, styledItem } from "./style-apply.js";
import { createStyleDialog } from "./style-state.js";

const button = (id: string, look: Readonly<Record<string, unknown>> = {}): NodeDoc => ({
  type: "Button",
  props: { id, label: "Book", link: "about", ...look },
});

const section = (id: string, content: NodeDoc[]): NodeDoc => ({
  type: "Section",
  props: { id, content },
});

/**
 * A site of two pages: Home with the Button `styled` and a plain one, About with another plain
 * one. A session on Home with `styled` selected.
 */
function setUp() {
  const site: SiteDoc = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [section("s", [button("styled"), button("plain")])];
  const about = newId("page");
  site.pages[about] = {
    ...structuredClone(home),
    id: about,
    slug: "about",
    title: "About",
    doc: { root: { props: {} }, content: [section("a", [button("other")])] },
  };
  site.pageOrder.push(about);
  const session = sessionWith(site);
  session.select("styled");
  const props = (pageId: PageId, id: string) => {
    const content = session.history.document.getState().pages[pageId]?.doc.content ?? [];
    const nodes = content.flatMap((each) => (each.props.content as NodeDoc[] | undefined) ?? []);
    return nodes.find((node) => node.props.id === id)?.props;
  };
  /** Gives `styled` a value, as the dialog's fields do: one step each. */
  const style = (name: string, value: unknown) =>
    session.edit("props", `Changed ${name}`, (draft) => {
      const found = draft.pages[site.homePageId]?.doc.content[0]?.props.content as
        | NodeDoc[]
        | undefined;
      const node = found?.find((each) => each.props.id === "styled");
      if (node !== undefined) node.props[name] = value;
    });
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, home: site.homePageId, about, props, style, labels };
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

describe("Style this ‹kind›…: where its changes apply (3.13a)", () => {
  it("makes the item's changes one step for this one only, which undo takes back at once", async () => {
    const { session, home, props, style, labels } = setUp();
    session.edit("props", "Before", () => undefined);
    const since = openStyle(session);
    style("lookShadow", "large");
    style("lookBackground", "accent");

    expect(await applyStyle(session, since, "this")).toBe(true);

    expect(labels().at(-1)).toBe("Styled Button");
    expect(props(home, "styled")).toMatchObject({ lookShadow: "large", lookBackground: "accent" });
    expect(props(home, "plain")).not.toHaveProperty("lookShadow");
    session.history.undo();
    expect(props(home, "styled")).not.toHaveProperty("lookShadow");
  });

  it("takes everything back on Cancel, leaving it to Redo", () => {
    const { session, home, props, style, labels } = setUp();
    const since = openStyle(session);
    style("lookShadow", "large");
    style("lookCorners", "full");

    cancelStyle(session, since);

    expect(props(home, "styled")?.lookShadow).toBeUndefined();
    expect(props(home, "styled")?.lookCorners).toBeUndefined();
    expect(labels()).toEqual(["Styled Button"]);
    expect(session.history.state.getState()).toMatchObject({ cursor: 0, canRedo: true });
  });

  it("gives every one on the page the look, with its changes, as one step", async () => {
    const { session, home, about, props, style, labels } = setUp();
    const since = openStyle(session);
    style("lookShadow", "large");

    expect(await applyStyle(session, since, "page")).toBe(true);

    expect(labels()).toEqual(["Styled every Button on this page"]);
    expect(props(home, "plain")?.lookShadow).toBe("large");
    expect(props(about, "other")).not.toHaveProperty("lookShadow");
    session.history.undo();
    expect(props(home, "styled")?.lookShadow).toBeUndefined();
    expect(props(home, "plain")?.lookShadow).toBeUndefined();
  });

  it("asks before every one on the site, and stays open with its changes when declined", async () => {
    const { session, home, about, props, style, labels } = setUp();
    const since = openStyle(session);
    style("lookShadow", "large");

    const declined = confirmer(false);
    expect(await applyStyle(session, since, "site", { siteWide: declined })).toBe(false);
    expect(declined.asked[0]?.action).toBe("Give every Button on the site this look?");
    expect(props(about, "other")).not.toHaveProperty("lookShadow");
    expect(props(home, "styled")?.lookShadow).toBe("large");

    const confirmed = confirmer(true);
    expect(await applyStyle(session, since, "site", { siteWide: confirmed })).toBe(true);
    expect(labels()).toEqual(["Styled every Button on the site"]);
    expect(props(about, "other")?.lookShadow).toBe("large");
    expect(props(home, "plain")?.lookShadow).toBe("large");
  });

  it("says when every one has the look already, and keeps the change to this one", async () => {
    const { session, style, labels } = setUp();
    const since = openStyle(session);
    style("lookShadow", undefined);
    const notify = vi.fn();

    expect(await applyStyle(session, since, "page", { notify })).toBe(true);

    expect(notify).toHaveBeenCalledWith("Every Button on this page has this look already.");
    expect(labels()).toEqual(["Styled Button"]);
  });

  it("makes the item's own values the theme's look, which it then follows, as one step", async () => {
    const { session, home, props, style, labels } = setUp();
    const since = openStyle(session);
    style("lookShadow", "large");
    const asked = confirmer(true);

    expect(await applyStyle(session, since, "theme", { theme: { siteWide: asked } })).toBe(true);

    const site = session.history.document.getState();
    expect(site.theme.looks?.Button).toMatchObject({ lookShadow: "large" });
    expect(props(home, "styled")?.lookShadow).toBeUndefined();
    // The other Buttons follow the look: the question said how many.
    expect(asked.asked[0]?.description).toContain("2");
    expect(labels()).toEqual(["Made the theme's look for Button"]);
    session.history.undo();
    expect(session.history.document.getState().theme.looks?.Button).toBeUndefined();
    expect(props(home, "styled")?.lookShadow).toBe(undefined);
  });

  it("is for one item with a look: not for several selected", () => {
    const { session } = setUp();
    expect(styledItem(session)?.component.label).toBe("Button");
    session.selectElements(["styled", "plain"]);
    expect(styledItem(session)).toBeUndefined();
  });
});

describe("registerStyleDialog (3.13a)", () => {
  it("names its command for the item's kind, opens the dialog, and is off in Content mode", () => {
    const { session } = setUp();
    const { commands, preferences } = registriesForTest();
    const state = createStyleDialog();
    const remove = registerStyleDialog(
      createWindowDialogs(),
      commands,
      session,
      preferences,
      state,
    );
    const command = () => commands.list().find((each) => each.id === COMMAND_IDS.styleThis);

    expect(command()).toMatchObject({ label: "Style This Button…", enabled: true });
    commands.run(COMMAND_IDS.styleThis);
    expect(state.getState()).toMatchObject({ open: true, scope: "this" });
    // AI apps' changes wait while it's open (3.13a review).
    expect(session.held()).toBe(true);
    state.setState({ open: false });
    expect(session.held()).toBe(false);

    preferences.changeMode("content");
    expect(command()).toMatchObject({ label: "Style This Button…", enabled: false });
    session.select(null);
    preferences.changeMode("design");
    expect(command()).toMatchObject({ label: "Style This…", enabled: false });
    remove();
    expect(command()).toBeUndefined();
  });
});
