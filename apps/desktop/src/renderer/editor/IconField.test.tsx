// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import type { NodeDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { EditPanelHost } from "./EditPanelHost.js";
import { currentPage } from "./editor-session.js";
import { IconField } from "./IconField.js";
import { starterSite } from "./starter-site.js";

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

// The picker draws every icon, which is slow in happy-dom beside the suite's other tests.
describe("the icon field (F-ED-22)", { timeout: 15_000 }, () => {
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
