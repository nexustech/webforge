// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import type { NodeDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../../shared/starter-site.js";
import { EditPanelHost } from "../../editor/EditPanelHost.js";
import { currentPage } from "../../editor/editor-session.js";
import { sessionWith } from "../../testing/fixtures.js";
import { IconField } from "./IconField.js";

afterEach(cleanup);

/** The starter page with a Button in its Section, selected, and its Edit panel. */
function setUp() {
  const site = starterSite();
  const section = site.pages[site.homePageId]?.doc.content[0];
  (section?.props.content as NodeDoc[] | undefined)?.push({
    type: "Button",
    props: { id: "button", label: "Call us" },
  });
  const session = sessionWith(site);
  session.select("button");
  render(
    <FieldRenderersProvider renderers={{ icon: IconField }}>
      <EditPanelHost session={session} flush={vi.fn()} />
    </FieldRenderersProvider>,
  );
  const button = () =>
    (currentPage(session)?.doc.content[0]?.props.content as NodeDoc[] | undefined)?.find(
      (node) => node.props.id === "button",
    )?.props;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, button, labels, user: userEvent.setup({ delay: null }) };
}

// Typing through a dialog, as the Picker's own tests do: slower beside the suite's other tests.
describe("the icon field (F-ED-22)", () => {
  it("chooses an icon in the picker, searched by what it shows, as one step", async () => {
    const { button, labels, user } = setUp();

    await user.click(screen.getByRole("button", { name: "Icon Choose an icon…" }));
    const picker = screen.getByRole("dialog", { name: "Choose an icon" });
    // "call" is one of the phone icon's tags.
    await user.type(within(picker).getByRole("searchbox"), "call");
    await user.dblClick(within(picker).getByRole("option", { name: "phone" }));

    expect(button()?.icon).toBe("phone");
    expect(labels()).toEqual(["Changed Button icon"]);
    expect(screen.getByRole("button", { name: "Icon Change icon (phone)…" })).toBeTruthy();
  });

  it("takes the icon away again, as one step", async () => {
    const { session, button, labels, user } = setUp();
    act(() =>
      session.edit("props", "Gave it an icon", (draft) => {
        const section = draft.pages[draft.homePageId]?.doc.content[0];
        const node = (section?.props.content as NodeDoc[] | undefined)?.at(-1);
        if (node !== undefined) node.props.icon = "phone";
      }),
    );

    await user.click(screen.getByRole("button", { name: "Remove icon" }));

    expect(button()?.icon).toBeUndefined();
    expect(labels().at(-1)).toBe("Changed Button icon");
  });
});

describe("a List's icon (F-ED-22)", () => {
  it("makes its style unavailable, saying why, until the icon is removed", async () => {
    const site = starterSite();
    const section = site.pages[site.homePageId]?.doc.content[0];
    (section?.props.content as NodeDoc[] | undefined)?.push({
      type: "List",
      props: { id: "list", icon: "check", items: [] },
    });
    const session = sessionWith(site);
    session.select("list");
    render(
      <FieldRenderersProvider renderers={{ icon: IconField }}>
        <EditPanelHost session={session} flush={vi.fn()} />
      </FieldRenderersProvider>,
    );
    const user = userEvent.setup({ delay: null });
    // The style is on the Style tab, the icon on the Content tab.
    const style = async () => {
      await user.click(screen.getByRole("tab", { name: "Style" }));
      return screen.getByRole<HTMLSelectElement>("combobox", { name: "Style" });
    };

    expect((await style()).disabled).toBe(true);
    expect(
      screen.getByText(
        "The list's icon takes the place of its markers. Remove the icon to choose a style.",
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Content" }));
    await user.click(screen.getByRole("button", { name: "Remove icon" }));

    expect((await style()).disabled).toBe(false);
  });
});
