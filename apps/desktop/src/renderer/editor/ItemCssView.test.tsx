// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { ItemCssView } from "./ItemCssView.js";
import type { ItemCssApi } from "./item-css.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The canvas styles worker, writing `html` for the item and a rule for each class. */
function fakeApi(
  html: string | null = '<h2 class="text-primary p-4">Fresh bread</h2>',
): ItemCssApi {
  return {
    itemHtml: vi.fn(async () => ({ status: "html" as const, html })),
    classCss: vi.fn(async (_theme, classes: readonly string[]) => ({
      status: "css" as const,
      css: classes.map((name) =>
        name === "text-primary" ? ".text-primary { color: var(--color-primary); }" : `.${name} {}`,
      ),
    })),
  };
}

function setUp(api = fakeApi()) {
  const session = sessionWith();
  const nodeId =
    session.history.document.getState().pages[session.ui.getState().pageId]?.doc.content[0]?.props
      .id;
  if (typeof nodeId !== "string") throw new Error("no section");
  session.select(nodeId);
  const copyText = vi.fn(async () => null);
  const openCustomCode = vi.fn();
  render(
    <ItemCssView
      session={session}
      api={api}
      copyText={copyText}
      groups={[{ field: "lookColor", classes: "text-primary!" }]}
      labelOf={(field) => (field === "lookColor" ? "Text colour" : field)}
      onOpenCustomCode={openCustomCode}
    />,
  );
  return { session, api, copyText, openCustomCode };
}

describe("ItemCssView (3.14)", () => {
  it("shows the item's markup, its classes by control with their tokens, and their rules", async () => {
    setUp();

    expect(await screen.findByText('<h2 class="text-primary p-4">Fresh bread</h2>')).toBeDefined();
    const classes = screen.getByRole("region", { name: "Classes by control" });
    expect(within(classes).getByText("Text colour")).toBeDefined();
    expect(within(classes).getByText("text-primary!")).toBeDefined();
    const rules = screen.getByRole("region", { name: "Stylesheet rules" });
    expect(rules.textContent).toContain(".text-primary { color: var(--color-primary); }");
    // It says it's read only, and where CSS of the person's own goes.
    expect(screen.getByText(/Read only/)).toBeDefined();
  });

  it("copies each part, and opens Custom Code", async () => {
    const { copyText, openCustomCode } = setUp();
    await screen.findByText('<h2 class="text-primary p-4">Fresh bread</h2>');

    await userEvent.click(screen.getByRole("button", { name: "Copy Markup" }));
    expect(copyText).toHaveBeenCalledWith('<h2 class="text-primary p-4">Fresh bread</h2>');
    expect(await screen.findByText("Copied")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Copy Classes by control" }));
    expect(copyText).toHaveBeenLastCalledWith("Text colour: text-primary!");
    await userEvent.click(screen.getByRole("button", { name: "Open Custom Code" }));
    expect(openCustomCode).toHaveBeenCalled();
  });

  it("asks again once the item changes", async () => {
    const { session, api } = setUp();
    await screen.findByText('<h2 class="text-primary p-4">Fresh bread</h2>');
    vi.mocked(api.itemHtml).mockResolvedValue({ status: "html", html: "<h2>Cakes</h2>" });

    act(() => {
      session.edit("props", "Edited", (draft) => {
        draft.settings.general.name = "Rosa's";
      });
    });

    expect(await screen.findByText("<h2>Cakes</h2>")).toBeDefined();
  });

  it("shows another item's CSS only once it has it, not the last item's", async () => {
    const { session, api } = setUp();
    await screen.findByText('<h2 class="text-primary p-4">Fresh bread</h2>');
    vi.mocked(api.itemHtml).mockResolvedValue({ status: "html", html: "<p>Other</p>" });

    act(() => session.select("other"));

    expect(screen.getByText("Writing the CSS…")).toBeDefined();
    expect(screen.queryByText('<h2 class="text-primary p-4">Fresh bread</h2>')).toBeNull();
    expect(await screen.findByText("<p>Other</p>")).toBeDefined();
  });

  it("says when the item is hidden", async () => {
    setUp(fakeApi(""));

    expect(
      await screen.findByText("This item is hidden here, so the export leaves it out."),
    ).toBeDefined();
  });
});
