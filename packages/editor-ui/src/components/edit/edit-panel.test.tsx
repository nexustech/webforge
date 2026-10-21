import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditPanel, type EditPanelField } from "./edit-panel.js";
import { type FieldRendererProps, fieldRenderer, registerFieldRenderer } from "./field-registry.js";

afterEach(cleanup);

const fields: EditPanelField[] = [
  { name: "text", kind: "text", label: "Text", group: "content", value: "Welcome" },
  {
    name: "size",
    kind: "select",
    label: "Size",
    group: "style",
    value: "large",
    options: [
      { label: "Large", value: "large" },
      { label: "Small", value: "small" },
    ],
  },
];

function setup(extra: EditPanelField[] = []) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <EditPanel
      heading="Heading"
      fields={[...fields, ...extra]}
      onChange={onChange}
      onCommit={onCommit}
    />,
  );
  return { onChange, onCommit, user: userEvent.setup() };
}

describe("EditPanel", () => {
  it("asks for a selection when nothing is selected", () => {
    render(<EditPanel fields={[]} onChange={vi.fn()} onCommit={vi.fn()} />);

    expect(screen.getByText(t("editPanel.empty"))).toBeDefined();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("shows the element's content fields first, its style fields on the Style tab", async () => {
    const { user } = setup();

    expect(screen.getByRole("heading", { name: "Heading" })).toBeDefined();
    expect(screen.getByLabelText("Text")).toBeDefined();
    expect(screen.queryByLabelText("Size")).toBeNull();

    await user.click(screen.getByRole("tab", { name: t("editPanel.style") }));
    expect(screen.getByLabelText("Size")).toBeDefined();
  });

  it("reports every keystroke and the end of a text field visit", async () => {
    const { onChange, onCommit, user } = setup();
    const field = screen.getByLabelText("Text");

    await user.type(field, "!");
    fireEvent.blur(field);

    expect(onChange).toHaveBeenCalledWith("text", "Welcome!");
    expect(onCommit).toHaveBeenCalledWith("text");
  });

  it("reports a choice as a change and its end at once", async () => {
    const { onChange, onCommit, user } = setup();
    await user.click(screen.getByRole("tab", { name: t("editPanel.style") }));

    await user.selectOptions(screen.getByLabelText("Size"), "small");

    expect(onChange).toHaveBeenCalledWith("size", "small");
    expect(onCommit).toHaveBeenCalledWith("size");
  });

  it("starts on Style when the element has only style fields, and says when a tab is empty", () => {
    render(
      <EditPanel
        heading="Section"
        fields={fields.filter((field) => field.group === "style")}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Size")).toBeDefined();
    expect(screen.getByRole("tab", { name: t("editPanel.style") }).getAttribute("data-state")).toBe(
      "active",
    );
  });

  it("draws registered kinds with their renderer and leaves out kinds nobody draws", () => {
    function Shout({ id, value }: FieldRendererProps) {
      return <output id={id}>{String(value).toUpperCase()}</output>;
    }
    const remove = registerFieldRenderer("shout", Shout);
    setup([
      { name: "loud", kind: "shout", label: "Loud", group: "content", value: "hi" },
      { name: "nope", kind: "unknown", label: "Nope", group: "content", value: 1 },
    ]);

    expect(screen.getByText("HI")).toBeDefined();
    expect(screen.queryByText("Nope")).toBeNull();
    remove();
    expect(fieldRenderer("shout")).toBeUndefined();
  });

  it("puts back the renderer a registration replaced", () => {
    const first = vi.fn(() => null);
    const second = vi.fn(() => null);
    const removeFirst = registerFieldRenderer("thing", first);
    const removeSecond = registerFieldRenderer("thing", second);

    removeFirst();
    expect(fieldRenderer("thing")).toBe(second);
    removeSecond();
    expect(fieldRenderer("thing")).toBe(first);
  });

  it("says when a tab has nothing to change", async () => {
    const user = userEvent.setup();
    render(
      <EditPanel
        heading="Heading"
        fields={fields.filter((field) => field.group === "content")}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: t("editPanel.style") }));

    expect(screen.getByText(t("editPanel.noFields"))).toBeDefined();
  });
});

describe("style field renderers (1.14 part 2)", () => {
  const sizes = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ];
  const styleFields: EditPanelField[] = [
    {
      name: "padding",
      kind: "spacing",
      label: "Padding",
      group: "style",
      value: "medium",
      options: sizes,
    },
    { name: "gap", kind: "slider", label: "Gap", group: "style", value: "small", steps: sizes },
    { name: "fullWidth", kind: "toggle", label: "Full width", group: "style", value: false },
  ];

  function renderStyle(overrides: Partial<EditPanelField> = {}) {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onReset = vi.fn();
    render(
      <EditPanel
        heading="Section"
        device="Mobile"
        fields={styleFields.map((field) =>
          field.name === "padding" ? { ...field, ...overrides } : field,
        )}
        onChange={onChange}
        onCommit={onCommit}
        onReset={onReset}
      />,
    );
    return { onChange, onCommit, onReset, user: userEvent.setup() };
  }

  it("makes one change and commits it for a choice, keeping the chosen one when clicked again", async () => {
    const { onChange, onCommit, user } = renderStyle();
    const group = screen.getByRole("radiogroup", { name: "Padding" });
    expect(group).toBeDefined();

    await user.click(screen.getByRole("radio", { name: "Large" }));
    await user.click(screen.getByRole("radio", { name: "Medium" }));

    expect(onChange.mock.calls).toEqual([["padding", "large"]]);
    expect(onCommit.mock.calls).toEqual([["padding"]]);
  });

  it("changes a slider step by step and commits when it is let go", () => {
    const { onChange, onCommit } = renderStyle();
    const slider = screen.getByLabelText("Gap") as HTMLInputElement;
    expect(slider.value).toBe("0");
    expect(slider.getAttribute("aria-valuetext")).toBe("Small");

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "2" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);

    expect(onChange.mock.calls).toEqual([["gap", "large"]]);
    expect(onCommit.mock.calls).toEqual([["gap"]]);
  });

  it("switches a toggle", async () => {
    const { onChange, onCommit, user } = renderStyle();

    await user.click(screen.getByRole("switch", { name: "Full width" }));

    expect(onChange.mock.calls).toEqual([["fullWidth", true]]);
    expect(onCommit.mock.calls).toEqual([["fullWidth"]]);
  });

  it("marks a value set for this device only, and offers the Desktop value back", async () => {
    const { onReset, user } = renderStyle({ overridden: true });

    expect(screen.getByText("Mobile only")).toBeDefined();
    await user.click(screen.getByRole("button", { name: t("editPanel.useDesktop") }));

    expect(onReset).toHaveBeenCalledWith("padding");
    expect(document.querySelectorAll("[data-override]")).toHaveLength(1);
  });
});

describe("list renderer (F-ED-6)", () => {
  const testimonials: EditPanelField = {
    name: "testimonials",
    kind: "list",
    label: "Testimonials",
    group: "content",
    itemLabel: "Testimonial",
    itemFields: [{ name: "quote", kind: "text", label: "Quote" }],
    value: [
      { key: "a", values: { quote: "Lovely bread" } },
      { key: "b", values: { quote: "" } },
    ],
  };

  function renderList(value: unknown = testimonials.value) {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const view = render(
      <EditPanel
        heading="Testimonials"
        fields={[{ ...testimonials, value }]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    return { onChange, onCommit, view, user: userEvent.setup() };
  }

  it("shows a row per item, named by its text or its place", () => {
    renderList();

    expect(screen.getByRole("group", { name: "Testimonials" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Lovely bread" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Testimonial 2" })).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Move Testimonial up" })[0]).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getAllByRole("button", { name: "Move Testimonial down" })[1]).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("reports moves, deletes and adds as list changes", async () => {
    const { onChange, user } = renderList();

    await user.click(
      screen.getAllByRole("button", { name: "Move Testimonial down" })[0] as Element,
    );
    await user.click(screen.getAllByRole("button", { name: "Delete Testimonial" })[1] as Element);
    await user.click(screen.getByRole("button", { name: "Add Testimonial" }));

    expect(onChange.mock.calls).toEqual([
      ["testimonials", { type: "move", key: "a", to: 1 }],
      ["testimonials", { type: "remove", key: "b" }],
      ["testimonials", { type: "add" }],
    ]);
  });

  it("opens an item to edit its fields, reporting each change and the end of typing", async () => {
    const { onChange, onCommit, user } = renderList();
    const row = screen.getByRole("button", { name: "Lovely bread" });

    await user.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("Quote"), { target: { value: "Lovely buns" } });
    fireEvent.blur(screen.getByLabelText("Quote"));

    expect(onChange).toHaveBeenCalledWith("testimonials", {
      type: "edit",
      key: "a",
      name: "quote",
      value: "Lovely buns",
    });
    expect(onCommit).toHaveBeenCalledWith("testimonials");
  });

  it("moves focus to the next row when an item is deleted, or to Add when none is left", async () => {
    const { view, user } = renderList();

    await user.click(screen.getAllByRole("button", { name: "Delete Testimonial" })[0] as Element);
    view.rerender(
      <EditPanel
        heading="Testimonials"
        fields={[{ ...testimonials, value: [{ key: "b", values: { quote: "" } }] }]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Testimonial 1" }));

    await user.click(screen.getByRole("button", { name: "Delete Testimonial" }));
    view.rerender(
      <EditPanel
        heading="Testimonials"
        fields={[{ ...testimonials, value: [] }]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add Testimonial" }));
  });

  it("opens the item Add creates once it arrives", async () => {
    const { view, user } = renderList([]);
    expect(screen.getByText(t("editPanel.list.empty"))).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Add Testimonial" }));
    view.rerender(
      <EditPanel
        heading="Testimonials"
        fields={[{ ...testimonials, value: [{ key: "new", values: { quote: "" } }] }]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Quote")).toBeDefined();
  });
});

describe("Advanced tab and checked text fields (F-ED-11)", () => {
  const anchor: EditPanelField = {
    name: "anchor",
    kind: "text",
    label: "Anchor ID",
    group: "advanced",
    value: "",
    validate: (value) => (/^[a-z]+(?:-[a-z]+)*$/.test(value) ? undefined : "Not an anchor"),
  };

  function renderAdvanced(advanced: boolean) {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <EditPanel
        heading="Heading"
        fields={[...fields, anchor]}
        onChange={onChange}
        onCommit={onCommit}
        advanced={advanced}
      />,
    );
    return { onChange, onCommit, user: userEvent.setup() };
  }

  it("shows the Advanced tab only when asked to", () => {
    renderAdvanced(false);
    expect(screen.queryByRole("tab", { name: t("editPanel.advanced") })).toBeNull();
    cleanup();

    renderAdvanced(true);
    expect(screen.getByRole("tab", { name: t("editPanel.advanced") })).toBeDefined();
  });

  it("reports a checked field's text only when it is valid and the user is done", async () => {
    const { onChange, onCommit, user } = renderAdvanced(true);
    await user.click(screen.getByRole("tab", { name: t("editPanel.advanced") }));
    const input = screen.getByLabelText("Anchor ID");

    // Passing through invalid text ("my-") on the way is fine.
    await user.type(input, "my-");
    expect(onChange).not.toHaveBeenCalled();
    await user.type(input, "{Enter}");
    expect(screen.getByText("Not an anchor")).toBeDefined();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();

    await user.type(input, "prices");
    fireEvent.blur(input);

    expect(onChange.mock.calls).toEqual([["anchor", "my-prices"]]);
    expect(onCommit).toHaveBeenCalledWith("anchor");
    expect(screen.queryByText("Not an anchor")).toBeNull();
  });

  it("starts afresh for another element, leaving nothing typed for the last one", async () => {
    const view = render(
      <EditPanel
        heading="Heading"
        fields={[anchor]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        advanced
        itemKey="a"
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Anchor ID"), "Oops{Enter}");
    expect(screen.getByText("Not an anchor")).toBeDefined();

    view.rerender(
      <EditPanel
        heading="Heading"
        fields={[anchor]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        advanced
        itemKey="b"
      />,
    );

    expect((screen.getByLabelText("Anchor ID") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Not an anchor")).toBeNull();
  });

  it("offers no moves in a list whose order means nothing", () => {
    render(
      <EditPanel
        heading="Heading"
        fields={[
          {
            name: "attributes",
            kind: "list",
            label: "Attributes",
            group: "content",
            itemLabel: "Attribute",
            orderless: true,
            itemFields: [{ name: "name", kind: "text", label: "Name" }],
            value: [
              { key: "0", values: { name: "role" } },
              { key: "1", values: { name: "title" } },
            ],
          },
        ]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Move Attribute up" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Delete Attribute" })).toHaveLength(2);
  });

  it("goes back to the stored text with Esc", async () => {
    const { onChange, user } = renderAdvanced(true);
    await user.click(screen.getByRole("tab", { name: t("editPanel.advanced") }));
    const input = screen.getByLabelText("Anchor ID") as HTMLInputElement;

    await user.type(input, "Oops{Escape}");
    fireEvent.blur(input);

    expect(input.value).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });
});
