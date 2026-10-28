// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NodeDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../../shared/ipc/prefs.js";
import { starterSite } from "../../../shared/starter-site.js";
import { createPreferencesStore } from "../../shell/preferences-store.js";
import { sessionWith } from "../../testing/fixtures.js";
import { StyleDialog } from "./StyleDialog.js";
import { openStyle } from "./style-apply.js";
import { createStyleDialog } from "./style-state.js";

afterEach(cleanup);

const button = (id: string): NodeDoc => ({
  type: "Button",
  props: { id, label: "Book", link: "about" },
});

/** The dialog open on the Button `styled` of a page with another Button, previews recorded. */
function setUp(editorLevel: "simple" | "advanced" = "simple") {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [
    { type: "Section", props: { id: "s", content: [button("styled"), button("plain")] } },
  ];
  const session = sessionWith(site);
  session.select("styled");
  const state = createStyleDialog();
  state.setState({ open: true, since: openStyle(session), scope: "this" });
  const previews = vi.fn((node: NodeDoc, device: string) => (
    <span data-testid={`preview-${device}`}>{String(node.props.lookShadow ?? "none")}</span>
  ));
  render(
    <StyleDialog
      session={session}
      state={state}
      preferences={createPreferencesStore({ preferences: { ...DEFAULT_PREFERENCES, editorLevel } })}
      itemPreviews={previews}
    />,
  );
  const props = (id: string) => {
    const page = session.history.document.getState().pages[site.homePageId];
    const nodes = (page?.doc.content[0]?.props.content as NodeDoc[] | undefined) ?? [];
    return nodes.find((node) => node.props.id === id)?.props;
  };
  return {
    session,
    state,
    props,
    dialog: () => within(screen.getByRole("dialog", { name: "Style this Button" })),
    labels: () => session.history.entries().map((entry) => entry.label),
    user: userEvent.setup({ delay: null }),
  };
}

describe("StyleDialog (3.13a, CT-2)", () => {
  it("shows the item's Appearance fields with their sources, and previews it on Desktop and Mobile", async () => {
    const { dialog, session } = setUp();

    expect(dialog().getByRole("button", { name: "Appearance" })).toBeTruthy();
    expect(dialog().queryByRole("tab")).toBeNull();
    expect(dialog().getByTestId("preview-desktop").textContent).toBe("none");
    expect(dialog().getByTestId("preview-mobile")).toBeTruthy();
    session.edit("props", "Changed Button shadow", (draft) => {
      const nodes = Object.values(draft.pages)[0]?.doc.content[0]?.props.content as NodeDoc[];
      const node = nodes.find((each) => each.props.id === "styled");
      if (node !== undefined) node.props.lookShadow = "large";
    });
    // 3.12's provenance: where each value comes from.
    await vi.waitFor(() =>
      expect(document.querySelector('[data-field="lookShadow"] [data-source]')?.textContent).toBe(
        "Set here",
      ),
    );
  });

  it("shows a change in the preview at once, and applies it to every one on the page as one step", async () => {
    const { dialog, session, state, props, labels, user } = setUp();
    session.edit("props", "Changed Button shadow", (draft) => {
      const nodes = Object.values(draft.pages)[0]?.doc.content[0]?.props.content as NodeDoc[];
      const node = nodes.find((each) => each.props.id === "styled");
      if (node !== undefined) node.props.lookShadow = "large";
    });

    await vi.waitFor(() =>
      expect(dialog().getByTestId("preview-desktop").textContent).toBe("large"),
    );
    const scopes = within(dialog().getByRole("group", { name: "Where it applies" }));
    const page = scopes.getByRole("radio", { name: /^Every Button on this page/ });
    expect(document.getElementById(page.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "1 other",
    );
    await user.click(page);
    await user.click(dialog().getByRole("button", { name: "Apply" }));

    expect(state.getState().open).toBe(false);
    expect(props("plain")?.lookShadow).toBe("large");
    expect(labels()).toEqual(["Styled every Button on this page"]);
  });

  it("takes its changes back on Cancel", async () => {
    const { dialog, session, state, props, user } = setUp();
    session.edit("props", "Changed Button shadow", (draft) => {
      const nodes = Object.values(draft.pages)[0]?.doc.content[0]?.props.content as NodeDoc[];
      const node = nodes.find((each) => each.props.id === "styled");
      if (node !== undefined) node.props.lookShadow = "large";
    });

    await user.click(dialog().getByRole("button", { name: "Cancel" }));

    expect(state.getState().open).toBe(false);
    expect(props("styled")?.lookShadow).toBeUndefined();
  });

  it("offers the theme's colours only in Simple mode, and a colour of its own in Advanced (ST-6, ADR 0009)", () => {
    setUp();
    expect(screen.queryAllByRole("radio", { name: "Custom" })).toEqual([]);
    cleanup();

    setUp("advanced");
    expect(screen.getAllByRole("radio", { name: "Custom" }).length).toBeGreaterThan(0);
  });

  it("offers the four places a change applies", () => {
    const { dialog } = setUp();

    const scopes = within(dialog().getByRole("group", { name: "Where it applies" }));
    expect(scopes.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "this",
      "page",
      "site",
      "theme",
    ]);
    expect(scopes.getByRole("radio", { name: /^This Button only/ })).toHaveProperty(
      "checked",
      true,
    );
  });
});
