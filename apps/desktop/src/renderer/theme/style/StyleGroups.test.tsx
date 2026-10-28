// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { afterEach, describe, expect, it } from "vitest";
import { starterSite } from "../../../shared/starter-site.js";
import { EditPanelHost } from "../../editor/EditPanelHost.js";
import { createPreferencesStore } from "../../shell/preferences-store.js";
import { sessionWith } from "../../testing/fixtures.js";
import { StyleGroups } from "./StyleGroups.js";

afterEach(cleanup);

/** A page with a Button and a Hero, the one `selected` selected. */
function setUp(selected: "button" | "hero", props: Readonly<Record<string, unknown>> = {}) {
  const site: SiteDoc = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const button: NodeDoc = { type: "Button", props: { id: "button", label: "Book", link: "" } };
  home.doc.content = [
    { type: "Hero", props: { id: "hero", title: "Rosa's", text: "Fresh bread" } },
    { type: "Section", props: { id: "s", content: [button] } },
  ];
  const session = sessionWith(site);
  const node = (id: string) => {
    const content = session.history.document.getState().pages[site.homePageId]?.doc.content ?? [];
    return id === "hero"
      ? content[0]
      : (content[1]?.props.content as NodeDoc[] | undefined)?.find((each) => each.props.id === id);
  };
  if (Object.keys(props).length > 0) {
    session.edit("props", "Set up", (draft) => {
      const page = draft.pages[site.homePageId];
      const target =
        selected === "hero"
          ? page?.doc.content[0]
          : (page?.doc.content[1]?.props.content as NodeDoc[] | undefined)?.[0];
      if (target !== undefined) Object.assign(target.props, props);
    });
  }
  session.select(selected);
  return { session, node, user: userEvent.setup({ delay: null }) };
}

/** The option groups' headings, in the order shown. */
const groups = () =>
  screen
    .getAllByRole("button")
    .map((each) => each.textContent ?? "")
    .filter((name) =>
      [
        "Appearance",
        "Background",
        "Border",
        "Corners",
        "Shadow",
        "Title",
        "Spacing",
        "When hovered",
      ].includes(name),
    );

describe("StyleGroups (3.13b, CT-2)", () => {
  it("shows an element's Appearance, then the deeper groups in order, with what each holds", () => {
    const { session } = setUp("button");
    render(<StyleGroups session={session} preferences={createPreferencesStore()} />);

    expect(groups()).toEqual([
      "Appearance",
      "Background",
      "Border",
      "Corners",
      "Shadow",
      "Spacing",
      "When hovered",
    ]);
    // The gradient in Background; the element's padding and its own margin in Spacing; 2.28's
    // hover row in When hovered, with the colour.
    for (const label of ["Gradient", "Top border", "Top left corner", "Inner shadow"]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
    expect(document.querySelector('[data-field="lookPadding"]')).not.toBeNull();
    expect(document.querySelector('[data-field="margin"]')).not.toBeNull();
    expect(document.querySelector('[data-field="hover"]')).not.toBeNull();
    expect(document.querySelector('[data-field="lookHoverColor"]')).not.toBeNull();
  });

  it("gives a titled section its Title group, and its background image and spacing their groups", () => {
    const { session } = setUp("hero");
    render(<StyleGroups session={session} preferences={createPreferencesStore()} />);

    expect(groups()).toContain("Title");
    expect(screen.getByLabelText("Subtitle size")).toBeTruthy();
    expect(document.querySelector('[data-field="padding"]')).not.toBeNull();
  });

  it("sets a deeper value as one labelled step, which the item draws", async () => {
    const { session, node, user } = setUp("button");
    render(<StyleGroups session={session} preferences={createPreferencesStore()} />);

    await user.selectOptions(screen.getByLabelText("Bottom border"), "thick");

    expect(node("button")?.props.lookBorderBottom).toBe("thick");
    expect(session.history.entries().at(-1)?.label).toBe("Changed Button bottom border");
  });

  it("shows a gradient on the Style tab's Colour, as one chip, in place of where it comes from (CT-4)", async () => {
    const { session, user } = setUp("button", {
      lookGradientDirection: "toBottom",
      lookGradientFrom: "primary",
      lookGradientTo: "accent",
    });
    render(<EditPanelHost session={session} flush={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Style" }));

    expect(document.querySelector('[data-field="lookBackground"] [data-source]')?.textContent).toBe(
      "Gradient (Style this Button…)",
    );
  });
});
