import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Check, Field, TextInput, TimeInput } from "./form.js";

afterEach(cleanup);

/** The text of the elements `element`'s `aria-describedby` names, in order. */
const description = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id !== "")
    .map((id) => document.getElementById(id)?.textContent);

describe("Field (R10)", () => {
  it("names its control, and describes it by its hint and then its error", () => {
    render(
      <Field label="Web address" hint="Where the site is published." error="Use only the address.">
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Web address" });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(description(input)).toEqual(["Where the site is published.", "Use only the address."]);
  });

  it("marks nothing invalid and describes nothing without a hint or an error", () => {
    render(<Field label="Name">{(control) => <input {...control} />}</Field>);
    const input = screen.getByRole("textbox", { name: "Name" });

    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("TextInput (R10)", () => {
  it("reports what is typed, up to its limit, on one line or several", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <TextInput label="Name" value="" maxLength={3} onChange={onChange} />
        <TextInput label="Address" multiline value="" onChange={() => {}} />
      </>,
    );

    await user.type(screen.getByRole("textbox", { name: "Name" }), "R");
    expect(onChange).toHaveBeenLastCalledWith("R");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("maxLength", 3);
    expect(screen.getByRole("textbox", { name: "Address" }).tagName).toBe("TEXTAREA");
  });
});

describe("Check and TimeInput (R10)", () => {
  it("reports a checkbox's new state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Check label="Include a sitemap" checked={false} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Include a sitemap" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("describes a time by its error", () => {
    const { container } = render(
      <TimeInput label="Opens" value="" error="Use a time such as 09:00." onChange={() => {}} />,
    );
    const input = container.querySelector("input");
    if (input === null) throw new Error("no input");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(description(input)).toEqual(["Use a time such as 09:00."]);
  });
});
