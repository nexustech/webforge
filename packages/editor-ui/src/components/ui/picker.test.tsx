import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Picker, type PickerItem } from "./picker.js";

afterEach(cleanup);

const ITEMS: readonly PickerItem[] = [
  { id: "cake", label: "cake.jpg", category: "Food", keywords: ["birthday"] },
  { id: "bread", label: "bread.jpg", category: "Food" },
  { id: "shop", label: "shop-front.jpg", category: "Places" },
  { id: "team", label: "team.jpg", category: "People" },
  { id: "oven", label: "oven.jpg", category: "Places" },
];

/** A picker opened by a button, as a field opens it, choosing into `onChoose`. */
function setUp(
  props: { value?: string; layout?: "grid" | "list"; items?: readonly PickerItem[] } = {},
) {
  const onChoose = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Choose an image…
        </button>
        <Picker
          open={open}
          onOpenChange={setOpen}
          title="Choose an image"
          description="Double-click an image to place it."
          items={props.items ?? ITEMS}
          categories={["Food", "Places", "People"]}
          columns={3}
          layout={props.layout ?? "grid"}
          value={props.value ?? null}
          renderItem={(item) => <span data-testid={`tile-${item.id}`} />}
          renderPreview={(item) => <p>Preview of {item.label}</p>}
          onChoose={onChoose}
          actions={<button type="button">Add new…</button>}
          emptyText="This site has no images yet."
        />
      </>
    );
  }
  render(<Host />);
  const opener = screen.getByRole("button", { name: "Choose an image…" });
  const options = () =>
    within(screen.getByRole("listbox", { hidden: true }))
      .queryAllByRole("option")
      .map((option) => option.textContent);
  const focused = () => document.activeElement?.textContent;
  return { onChoose, opener, options, focused };
}

// Each test types and moves through a dialog: about a second alone, but slower beside the whole
// suite's other tests (coverage, parallel workers), so the 5 s default isn't always enough.
describe("Picker (UX-15)", { timeout: 15_000 }, () => {
  it("searches by name, category or keyword, and says when nothing matches", async () => {
    const { opener, options } = setUp();
    await userEvent.click(opener);

    expect(screen.getByRole("dialog", { name: "Choose an image" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search" }));
    expect(options()).toHaveLength(5);
    await userEvent.keyboard("birthday");
    expect(options()).toEqual(["cake.jpg"]);
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.keyboard("places");
    expect(options()).toEqual(["shop-front.jpg", "oven.jpg"]);
    await userEvent.keyboard(" zzz");
    // Shown in the list, and read out by the status.
    expect(screen.getAllByText("Nothing matches 'places zzz'.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Choose" })).toHaveProperty("disabled", true);
    // Twenty keystrokes, each redrawing the dialog: about a second alone, more beside the whole
    // suite's other tests.
  }, 15_000);

  it("shows one category at a time", async () => {
    const { opener, options } = setUp();
    await userEvent.click(opener);

    await userEvent.click(screen.getByRole("button", { name: "People" }));
    expect(options()).toEqual(["team.jpg"]);
    expect(screen.getByRole("button", { name: "People" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(options()).toHaveLength(5);
  });

  it("moves through the grid with the arrows, Home and End, and chooses with Enter", async () => {
    const { opener, onChoose, focused } = setUp({ value: "bread" });
    await userEvent.click(opener);

    // Down from the search field: the current choice.
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("bread.jpg");
    expect(screen.getByText("Preview of bread.jpg")).toBeTruthy();
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("shop-front.jpg");
    // Down a row of three.
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowDown}");
    expect(focused()).toBe("team.jpg");
    await userEvent.keyboard("{End}");
    expect(focused()).toBe("oven.jpg");
    await userEvent.keyboard("{Home}");
    expect(focused()).toBe("cake.jpg");
    // Up from the first row: back to the search field.
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    await userEvent.keyboard("{ArrowDown}{ArrowRight}{Enter}");

    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ITEMS[1]);
    expect(screen.queryByRole("dialog")).toBeNull();
    // Back where the person was.
    expect(document.activeElement).toBe(opener);
  });

  it("moves up and down a list, and hands typing to the search field", async () => {
    const { opener, focused, options } = setUp({ layout: "list" });
    await userEvent.click(opener);

    await userEvent.keyboard("{ArrowDown}{ArrowRight}");
    expect(focused()).toBe("cake.jpg");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("bread.jpg");
    await userEvent.keyboard("m");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    expect(options()).toEqual(["team.jpg"]);
  });

  it("picks with a click, chooses with a double-click, Enter in the search or Choose", async () => {
    const { opener, onChoose } = setUp();
    await userEvent.click(opener);

    await userEvent.click(screen.getByRole("option", { name: "team.jpg" }));
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "team.jpg" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(onChoose).toHaveBeenLastCalledWith(ITEMS[3]);

    await userEvent.click(opener);
    await userEvent.dblClick(screen.getByRole("option", { name: "oven.jpg" }));
    expect(onChoose).toHaveBeenLastCalledWith(ITEMS[4]);

    await userEvent.click(opener);
    await userEvent.keyboard("shop{Enter}");
    expect(onChoose).toHaveBeenLastCalledWith(ITEMS[2]);
  });

  it("clears the search with Esc before closing, choosing nothing", async () => {
    const { opener, onChoose, options } = setUp();
    await userEvent.click(opener);

    await userEvent.keyboard("cake{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(options()).toHaveLength(5);
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("says when there is nothing to choose, keeping its own actions", async () => {
    const { opener } = setUp({ items: [] });
    await userEvent.click(opener);

    expect(screen.getByText("This site has no images yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add new…" })).toBeTruthy();
  });

  it("chooses the first match with Enter after a search, even when the current choice matches too", async () => {
    // The current choice is oven.jpg; "s" (in Places) matches shop-front.jpg first.
    const { opener, onChoose } = setUp({ value: "oven" });
    await userEvent.click(opener);

    await userEvent.keyboard("s{Enter}");

    expect(onChoose).toHaveBeenCalledExactlyOnceWith(ITEMS[2]);
  });

  it("says how many match as the person types", async () => {
    const { opener } = setUp();
    await userEvent.click(opener);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");

    await userEvent.keyboard("jpg");
    expect(status.textContent).toBe("5 matches");
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}cake");
    expect(status.textContent).toBe("1 match");
    await userEvent.keyboard("zzz");
    expect(status.textContent).toBe("Nothing matches 'cakezzz'.");
  });

  it("scrolls the current choice into view when it opens", async () => {
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView() {
      scrolled.push(this);
    };
    try {
      const { opener } = setUp({ value: "team" });
      await userEvent.click(opener);
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(scrolled.map((element) => element.textContent)).toEqual(["team.jpg"]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
