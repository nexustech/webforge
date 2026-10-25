// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeField } from "./CodeField.js";

afterEach(cleanup);

describe("CodeField", () => {
  it("reports what is typed, and that the person is done", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <>
        <span id="label">Code</span>
        <CodeField
          id="field"
          labelId="label"
          field={{ kind: "code", label: "Code" }}
          value={undefined}
          onChange={onChange}
          onCommit={onCommit}
        />
      </>,
    );

    const box = screen.getByRole("textbox", { name: "Code" });
    fireEvent.change(box, { target: { value: "new" } });
    fireEvent.blur(box);

    expect(onChange).toHaveBeenCalledWith("new");
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
