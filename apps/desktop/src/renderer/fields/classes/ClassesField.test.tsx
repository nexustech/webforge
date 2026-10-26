// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldRendererProps } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasApi } from "../../../shared/ipc/canvas.js";
import { sessionWith } from "../../testing/fixtures.js";
import { ClassesField } from "./ClassesField.js";

afterEach(cleanup);

/** What the canvas CSS worker knows: these classes make a style, nothing else does. */
const KNOWN: Readonly<Record<string, string>> = {
  "p-4": ".p-4 { padding: 1rem; }",
  "bg-primary": ".bg-primary { background-color: var(--color-primary); }",
  "bg-primary-content": ".bg-primary-content { background-color: var(--color-primary-content); }",
  "shadow-lg": ".shadow-lg { box-shadow: var(--shadow-lg); }",
};

function fakeCanvas(): CanvasApi {
  return {
    classCatalogue: vi.fn(() =>
      Promise.resolve({ status: "loaded" as const, classes: Object.keys(KNOWN), variants: ["md"] }),
    ),
    classCss: vi.fn((_theme, classes: readonly string[]) =>
      Promise.resolve({ status: "css" as const, css: classes.map((name) => KNOWN[name] ?? null) }),
    ),
    compileCss: () => Promise.resolve({ status: "failed" as const }),
  };
}

/** The field showing `value`, and what it reports. */
function setUp(value = "") {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const canvas = fakeCanvas();
  const props: FieldRendererProps<"classes"> = {
    id: "classes",
    labelId: "classes-label",
    field: { kind: "classes", label: "CSS classes", validate: () => undefined },
    value,
    onChange,
    onCommit,
  };
  render(
    <>
      <label id="classes-label" htmlFor="classes">
        CSS classes
      </label>
      <ClassesField {...props} session={sessionWith()} canvas={() => canvas} />
    </>,
  );
  return {
    onChange,
    onCommit,
    canvas,
    input: () => screen.getByRole("combobox", { name: "CSS classes" }) as HTMLInputElement,
    user: userEvent.setup({ delay: null }),
  };
}

describe("the CSS classes field (#276)", { timeout: 15_000 }, () => {
  it("suggests the site's classes as one is typed, and keeps the value as one change", async () => {
    const { input, onChange, onCommit, user } = setUp();
    // The catalogue comes from the worker once.
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Browse classes…" })).toHaveProperty(
        "disabled",
        false,
      ),
    );

    await user.type(input(), "bg-pri");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "bg-primary",
      "bg-primary-content",
    ]);
    await user.keyboard("{Enter}");
    expect(input().value).toBe("bg-primary ");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("bg-primary ");
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("warns about a class that makes no style, with the closest that does, and keeps it", async () => {
    setUp("shadow-lg pading-4");

    expect(await screen.findByText("No style called pading-4. Did you mean p-4?")).toBeTruthy();
    expect(screen.queryByText(/No style called shadow-lg/)).toBeNull();
  });

  it("browses the classes by category, each previewed with its CSS, and adds one", async () => {
    const { onChange, onCommit, user } = setUp("shadow-lg");
    const browse = screen.getByRole("button", { name: "Browse classes…" });
    await vi.waitFor(() => expect(browse).toHaveProperty("disabled", false));

    await user.click(browse);
    const picker = within(screen.getByRole("dialog", { name: "Browse classes" }));
    expect(picker.getByRole("button", { name: "Colours" })).toBeTruthy();
    await user.type(picker.getByRole("searchbox"), "p-4");
    expect(await picker.findByText(".p-4 { padding: 1rem; }")).toBeTruthy();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("shadow-lg p-4");
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
