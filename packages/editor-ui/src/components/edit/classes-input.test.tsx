// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassesInput, replaceWord, wordAt } from "./classes-input.js";

afterEach(cleanup);

describe("the class under the caret (#276)", () => {
  it("is the run of non-spaces the caret is in or just after", () => {
    expect(wordAt("shadow-lg bg-pri", 16)).toEqual({ start: 10, end: 16, word: "bg-pri" });
    expect(wordAt("shadow-lg bg-pri", 4)).toEqual({ start: 0, end: 9, word: "shadow-lg" });
    expect(wordAt("shadow-lg ", 10)).toEqual({ start: 10, end: 10, word: "" });
  });

  it("is replaced by a suggestion, with a space after it and the caret after that", () => {
    expect(replaceWord("shadow-lg bg-pri", wordAt("shadow-lg bg-pri", 16), "bg-primary")).toEqual({
      text: "shadow-lg bg-primary ",
      caret: 21,
    });
    expect(replaceWord("md:fl italic", wordAt("md:fl italic", 5), "md:flex")).toEqual({
      text: "md:flex italic",
      caret: 8,
    });
  });

  it("is replaced by a variant with no space after it, ready for its class", () => {
    expect(replaceWord("p-4 ho", wordAt("p-4 ho", 6), "hover:")).toEqual({
      text: "p-4 hover:",
      caret: 10,
    });
  });
});

/** The combobox with its own value, suggesting `bg-` classes; what it says it's done with. */
function setUp() {
  const onDone = vi.fn();
  const onRevert = vi.fn();
  function Host() {
    const [value, setValue] = useState("");
    return (
      <>
        <label htmlFor="classes">CSS classes</label>
        <ClassesInput
          id="classes"
          value={value}
          onValueChange={setValue}
          onDone={() => onDone(value)}
          onRevert={onRevert}
          listLabel="Suggested classes"
          suggest={(word) =>
            ["bg-primary", "bg-primary-content", "bg-secondary"].filter((name) =>
              name.startsWith(word),
            )
          }
        />
      </>
    );
  }
  render(<Host />);
  return {
    onDone,
    onRevert,
    input: () => screen.getByRole("combobox", { name: "CSS classes" }) as HTMLInputElement,
    user: userEvent.setup({ delay: null }),
  };
}

describe("ClassesInput (#276)", () => {
  it("suggests as a class is typed, as an APG combobox, and takes one with Enter", async () => {
    const { input, onDone, user } = setUp();

    await user.type(input(), "bg-pri");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(input().getAttribute("aria-autocomplete")).toBe("list");
    const list = screen.getByRole("listbox", { name: "Suggested classes" });
    expect(input().getAttribute("aria-controls")).toBe(list.id);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "bg-primary",
      "bg-primary-content",
    ]);
    expect(input().getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "bg-primary" }).id,
    );

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("option", { name: "bg-primary-content" }).getAttribute("aria-selected"),
    ).toBe("true");
    await user.keyboard("{Enter}");

    expect(input().value).toBe("bg-primary-content ");
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("closes the suggestions with Esc, then goes back with a second Esc; Enter is done", async () => {
    const { input, onDone, onRevert, user } = setUp();

    await user.type(input(), "bg-sec");
    await user.keyboard("{Escape}");
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(onRevert).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onRevert).toHaveBeenCalledOnce();

    await user.keyboard("{Enter}");
    expect(onDone).toHaveBeenCalledWith("bg-sec");
  });

  it("takes a suggestion clicked, and is done when the field is left", async () => {
    const { input, onDone, user } = setUp();

    await user.type(input(), "bg-s");
    await user.click(screen.getByRole("option", { name: "bg-secondary" }));
    expect(input().value).toBe("bg-secondary ");
    expect(onDone).not.toHaveBeenCalled();

    await user.tab();
    expect(onDone).toHaveBeenCalledWith("bg-secondary ");
  });
});
