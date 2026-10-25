// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NameDialog } from "./NameDialog.js";

afterEach(cleanup);

function setUp(initialValue = "") {
  const onSubmit = vi.fn();
  render(
    <NameDialog
      open
      title="Add a page"
      label="Page name"
      initialValue={initialValue}
      confirm="Add Page"
      maxLength={20}
      describe={(name) => `File name: ${name.toLowerCase()}.html`}
      problem={(name) => (name === "Home" ? "A page is called that" : undefined)}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  );
  const field = () => screen.getByRole("textbox", { name: "Page name" });
  const confirm = () => screen.getByRole("button", { name: "Add Page" });
  return { onSubmit, field, confirm, user: userEvent.setup({ delay: null }) };
}

describe("NameDialog (2.21)", () => {
  it("adds the name trimmed, describing it as it's typed, within the model's limit", async () => {
    const { onSubmit, field, confirm, user } = setUp();
    expect(confirm()).toHaveProperty("disabled", true);
    expect(field().getAttribute("maxlength")).toBe("20");

    await user.type(field(), " About ");
    expect(screen.getByText("File name: about.html")).toBeTruthy();
    await user.click(confirm());

    expect(onSubmit).toHaveBeenCalledWith("About");
  });

  it("says why a name can't be used, with the confirm button off", async () => {
    const { onSubmit, field, confirm, user } = setUp();

    await user.type(field(), "Home");

    expect(field().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("A page is called that")).toBeTruthy();
    expect(confirm()).toHaveProperty("disabled", true);
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("selects the name it opens with, to type over it", () => {
    const { field } = setUp("Our team");

    const input = field() as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Our team".length]);
  });
});
