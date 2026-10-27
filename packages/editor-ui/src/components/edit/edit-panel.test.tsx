import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditPanel, type EditPanelField, hasBuiltInRenderer } from "./edit-panel.js";
import { FieldRenderersProvider } from "./field-context.js";
import type { FieldRendererProps } from "./field-spec.js";
import { ListField } from "./list-field.js";

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

  it("shows the Content tab only in Content mode, without Style or Advanced (M3)", () => {
    render(
      <EditPanel
        heading="Heading"
        fields={[
          ...fields,
          { name: "classes", kind: "text", label: "Classes", group: "advanced", value: "" },
        ]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        advanced
        contentOnly
      />,
    );

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      t("editPanel.content"),
    ]);
    expect(screen.getByLabelText("Text")).toBeDefined();
    expect(screen.queryByLabelText("Size")).toBeNull();
    expect(screen.queryByLabelText("Classes")).toBeNull();
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

  it("shows a field's help under it, and describes its control by it", async () => {
    const { user } = setup([
      {
        name: "autoplay",
        kind: "toggle",
        label: "Play automatically",
        help: "Never for visitors who prefer less motion.",
        group: "style",
        value: false,
      },
    ]);
    await user.click(screen.getByRole("tab", { name: t("editPanel.style") }));

    const control = screen.getByRole("switch", { name: "Play automatically" });
    const helpId = control.getAttribute("aria-describedby");
    expect(helpId).not.toBeNull();
    expect(document.getElementById(helpId ?? "")?.textContent).toBe(
      "Never for visitors who prefer less motion.",
    );
    // A field without help is described by nothing.
    expect(screen.getByLabelText("Size").getAttribute("aria-describedby")).toBeNull();
  });

  it("shows a field's warning under it, before its help, and describes its control by both (2.26)", async () => {
    const { user } = setup([
      {
        name: "overlay",
        kind: "toggle",
        label: "Overlay",
        help: "A layer of colour over the image.",
        warning: "The text may be hard to read on some images.",
        group: "style",
        value: false,
      },
    ]);
    await user.click(screen.getByRole("tab", { name: t("editPanel.style") }));

    const control = screen.getByRole("switch", { name: "Overlay" });
    const described = document.getElementById(control.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(
      "The text may be hard to read on some images.A layer of colour over the image.",
    );
    // Its sign is for the eye only.
    expect(described?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
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

  it("draws the kinds it is given renderers for, and leaves out kinds nobody draws (R11)", () => {
    function Shout({ id, value }: FieldRendererProps<"link">) {
      return <output id={id}>{String(value).toUpperCase()}</output>;
    }
    render(
      <FieldRenderersProvider renderers={{ link: Shout }}>
        <EditPanel
          heading="Button"
          fields={[
            { name: "loud", kind: "link", label: "Loud", group: "content", value: "hi" },
            { name: "nope", kind: "image", label: "Nope", group: "content", value: 1 },
          ]}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      </FieldRenderersProvider>,
    );

    expect(screen.getByText("HI")).toBeDefined();
    expect(screen.queryByText("Nope")).toBeNull();
  });

  it("draws a list's item fields when the list is drawn on its own (R11 review)", async () => {
    render(
      <ListField
        id="quotes"
        labelId="quotes-label"
        field={{
          kind: "list",
          label: "Quotes",
          itemLabel: "Quote",
          itemFields: [{ name: "quote", kind: "text", label: "Words" }],
        }}
        value={[{ id: "a", quote: "Hi" }]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Hi/ }));
    expect(screen.getByRole("textbox", { name: "Words" })).toHaveProperty("value", "Hi");
  });

  it("lets two panels draw a kind with different renderers, and replace a built-in one (R11)", () => {
    const draw = (word: string) =>
      function Word({ id }: FieldRendererProps<"text">) {
        return <output id={id}>{word}</output>;
      };
    const panel = (heading: string) => (
      <EditPanel
        heading={heading}
        fields={[{ name: "title", kind: "text", label: "Title", group: "content", value: "" }]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    );
    render(
      <>
        <FieldRenderersProvider renderers={{ text: draw("first") }}>
          {panel("One")}
        </FieldRenderersProvider>
        <FieldRenderersProvider renderers={{ text: draw("second") }}>
          {panel("Two")}
        </FieldRenderersProvider>
        {panel("Three")}
      </>,
    );

    expect(screen.getByText("first")).toBeDefined();
    expect(screen.getByText("second")).toBeDefined();
    // Without renderers of its own, a panel draws text with its built-in field.
    expect(screen.getAllByRole("textbox", { name: "Title" })).toHaveLength(1);
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

describe("disabled fields and fields with an error (R11)", () => {
  const sizes = [
    { label: "Small", value: "small" },
    { label: "Large", value: "large" },
  ];
  const every: EditPanelField[] = [
    { name: "title", kind: "text", label: "Title", group: "content", value: "Hi" },
    {
      name: "align",
      kind: "select",
      label: "Alignment",
      group: "content",
      value: "small",
      options: sizes,
    },
    { name: "wide", kind: "toggle", label: "Full width", group: "content", value: false },
    { name: "gap", kind: "slider", label: "Gap", group: "content", value: "small", steps: sizes },
    {
      name: "padding",
      kind: "spacing",
      label: "Padding",
      group: "content",
      value: "small",
      options: sizes,
    },
    {
      name: "margin",
      kind: "box",
      label: "Margin",
      group: "content",
      value: {},
      options: sizes,
      sides: [{ label: "Top", value: "top" }],
    },
    {
      name: "quotes",
      kind: "list",
      label: "Quotes",
      group: "content",
      itemLabel: "Quote",
      itemFields: [{ name: "quote", kind: "text", label: "Words" }],
      value: [{ id: "a", quote: "Hi" }],
    },
  ];
  const draw = (state: Pick<EditPanelField, "disabled" | "error">) =>
    render(
      <EditPanel
        heading="Section"
        fields={every.map((field) => ({ ...field, ...state }))}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

  it("disables every control of a disabled field", () => {
    draw({ disabled: true });

    // The fields' own controls, not the option groups' headers. A list's items still open, so
    // what they say can be read.
    const controls = document.querySelectorAll("[data-field] :is(input, select, button)");
    expect(controls.length).toBeGreaterThan(every.length);
    for (const control of controls) {
      const opens = control.hasAttribute("data-list-row");
      expect(control.matches(":disabled"), control.outerHTML).toBe(!opens);
    }
  });

  it("resets no disabled field, from its menu, its group or its device dot", async () => {
    const onResetToDefault = vi.fn();
    const onReset = vi.fn();
    render(
      <EditPanel
        heading="Section"
        device="Mobile"
        fields={[
          {
            name: "align",
            kind: "select",
            label: "Alignment",
            group: "style",
            value: "large",
            options: sizes,
            changed: true,
            overridden: true,
            disabled: true,
          },
        ]}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        onReset={onReset}
        onResetToDefault={onResetToDefault}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Alignment"));
    expect(
      screen
        .getByRole("menuitem", { name: t("editPanel.resetField") })
        .hasAttribute("data-disabled"),
    ).toBe(true);
    // The dot says the value is Mobile's own, but doesn't offer to clear it.
    expect(screen.queryByRole("button", { name: /Mobile/ })).toBeNull();
    expect(onReset).not.toHaveBeenCalled();
    expect(onResetToDefault).not.toHaveBeenCalled();
  });

  it("opens a disabled list's item to show its fields, disabled too", async () => {
    draw({ disabled: true });

    await userEvent.click(screen.getByRole("button", { name: /Hi/ }));
    expect(screen.getByRole("textbox", { name: "Words" }).matches(":disabled")).toBe(true);
  });

  it("shows a field's error under it, and marks its control invalid and described by it", () => {
    draw({ error: "Not like this" });

    expect(screen.getAllByText("Not like this")).toHaveLength(every.length);
    for (const name of ["Title", "Alignment", "Gap"]) {
      const control = screen.getByLabelText(name);
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.getAttribute("aria-describedby")).toMatch(/-error$/);
    }
    expect(screen.getByRole("switch", { name: "Full width" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
    for (const name of ["Padding", "Margin"]) {
      const choices = screen.getByRole("radiogroup", { name });
      expect(choices.getAttribute("aria-invalid")).toBe("true");
      expect(choices.getAttribute("aria-describedby")).toMatch(/-error$/);
    }
    // A list's group can't be invalid; its message describes it.
    expect(screen.getByRole("group", { name: "Quotes" }).getAttribute("aria-describedby")).toMatch(
      /-error$/,
    );
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

  function renderStyle(
    overrides: Partial<Pick<EditPanelField, "changed" | "responsive" | "overridden">> = {},
  ) {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onReset = vi.fn();
    const onResetToDefault = vi.fn();
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
        onResetToDefault={onResetToDefault}
      />,
    );
    return { onChange, onCommit, onReset, onResetToDefault, user: userEvent.setup() };
  }

  it("reaches every control of its two-column rows by Tab, in reading order (LF-7, #278)", async () => {
    const { user } = renderStyle();
    const reached: string[] = [];
    // From the search field through the Style tab's rows: a group header, then each row's control.
    screen.getByRole("searchbox", { name: "Search options" }).focus();
    const wanted = ["padding", "gap", "fullWidth"];
    // At most 30 steps, stopping once all three are reached: each Tab is slow on a busy machine (#519).
    for (let step = 0; step < 30 && !wanted.every((name) => reached.includes(name)); step += 1) {
      await user.tab();
      const at = document.activeElement;
      const name =
        at?.getAttribute("aria-label") ?? at?.closest("[data-field]")?.getAttribute("data-field");
      if (name !== null && name !== undefined && !reached.includes(name)) reached.push(name);
    }
    expect(reached).toEqual(expect.arrayContaining(wanted));
  });

  it("copies a group's values from one element and pastes them on another, as one step (SP-7)", async () => {
    const onPaste = vi.fn();
    const onResetToDefault = vi.fn();
    const props = {
      heading: "Section",
      onChange: vi.fn(),
      onCommit: vi.fn(),
      onPaste,
      onResetToDefault,
    };
    const view = render(<EditPanel {...props} fields={styleFields} itemKey="a" />);
    const user = userEvent.setup();
    // Nothing copied yet, nothing changed: no paste or reset to do.
    expect(screen.getByRole("button", { name: "Paste Spacing" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Reset Spacing" }).hasAttribute("disabled")).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: "Copy Spacing" }));
    view.rerender(
      <EditPanel
        {...props}
        itemKey="b"
        fields={styleFields.map((field) =>
          field.name === "padding" ? { ...field, value: "large", changed: true } : field,
        )}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Paste Spacing" }));
    await user.click(screen.getByRole("button", { name: "Reset Spacing" }));

    expect(onPaste).toHaveBeenCalledExactlyOnceWith({ padding: "medium" }, "Spacing");
    expect(onResetToDefault).toHaveBeenCalledExactlyOnceWith(["padding"], "Spacing");
  });

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

  it("scrubs a slider by dragging its step's name, finer with Shift, as one change (UX-20)", () => {
    const { onChange, onCommit } = renderStyle();
    const output = screen.getByText("Small", { selector: "output" });
    const move = (movementX: number, shiftKey = false) =>
      output.dispatchEvent(new PointerEvent("pointermove", { movementX, shiftKey }));

    fireEvent.pointerDown(output, { button: 0, pointerId: 1 });
    // 12 pixels a step: Medium, then Large.
    move(8);
    move(8);
    move(12);
    // With Shift, 36 pixels a step: 30 isn't enough, back past Large's start is.
    move(-30, true);
    expect(onCommit).not.toHaveBeenCalled();
    move(-10, true);
    output.dispatchEvent(new PointerEvent("pointerup"));

    expect(onChange.mock.calls).toEqual([
      ["gap", "medium"],
      ["gap", "large"],
      ["gap", "medium"],
    ]);
    expect(onCommit.mock.calls).toEqual([["gap"]]);
  });

  it("switches a toggle", async () => {
    const { onChange, onCommit, user } = renderStyle();

    await user.click(screen.getByRole("switch", { name: "Full width" }));

    expect(onChange.mock.calls).toEqual([["fullWidth", true]]);
    expect(onCommit.mock.calls).toEqual([["fullWidth"]]);
  });

  it("resets a changed field from its right-click menu or with Cmd+Esc (UX-13, #290)", async () => {
    const { onResetToDefault, user } = renderStyle({ changed: true });

    // The keys first: a closing menu hands focus back to the field a moment later, which a busy
    // machine could let land after the radio is focused (#519).
    screen.getByRole("radio", { name: "Small" }).focus();
    // Ctrl + Esc opens Windows' Start menu, so only Cmd + Esc resets (#290).
    await user.keyboard("{Control>}{Escape}{/Control}");
    expect(onResetToDefault).not.toHaveBeenCalled();
    await user.keyboard("{Meta>}{Escape}{/Meta}");
    expect(onResetToDefault).toHaveBeenCalledExactlyOnceWith(["padding"]);

    // A right-click on the field's label (a text field keeps its own menu, with spelling).
    fireEvent.contextMenu(screen.getByText("Padding", { selector: "label" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reset to Default" }));
    expect(onResetToDefault).toHaveBeenCalledTimes(2);
    expect(onResetToDefault).toHaveBeenLastCalledWith(["padding"]);
  });

  it("leaves a right-click in a field to the field (its own menu: spelling, cut, copy, paste)", () => {
    renderStyle({ changed: true });

    fireEvent.contextMenu(screen.getByRole("radio", { name: "Small" }));

    expect(screen.queryByRole("menuitem", { name: "Reset to Default" })).toBeNull();
  });

  it("offers no reset for a field that is as it was by default", async () => {
    const { onResetToDefault, user } = renderStyle();

    fireEvent.contextMenu(screen.getByText("Gap", { selector: "label" }));
    const reset = await screen.findByRole("menuitem", { name: "Reset to Default" });
    expect(reset.getAttribute("aria-disabled")).toBe("true");
    await user.keyboard("{Escape}");
    screen.getByLabelText("Gap").focus();
    await user.keyboard("{Meta>}{Escape}{/Meta}");
    expect(onResetToDefault).not.toHaveBeenCalled();
  });

  it("groups the fields by what they set, each group closing and opening (UX-13)", async () => {
    const { user } = renderStyle();
    const group = (name: string) => screen.getByRole("button", { name });

    expect(
      screen.getAllByRole("button", { expanded: true }).map((button) => button.textContent),
    ).toEqual(["Spacing", "Options"]);
    await user.click(group("Options"));

    expect(group("Options").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Gap")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Padding" })).toBeDefined();
    await user.click(group("Options"));
    expect(screen.getByLabelText("Gap")).toBeDefined();
  });

  it("closes every group with Ctrl/Cmd+Enter on a group's title, and opens them again (UX-13)", async () => {
    const { user } = renderStyle();
    screen.getByRole("button", { name: "Spacing" }).focus();

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(2);
  });

  it("shows a changed group's title in the accent colour, and resets the group as one change (UX-18)", async () => {
    const { onResetToDefault, user } = renderStyle({ changed: true });
    const spacing = screen.getByRole("button", { name: "Spacing" });

    expect(spacing.hasAttribute("data-changed")).toBe(true);
    expect(screen.getByRole("button", { name: "Options" }).hasAttribute("data-changed")).toBe(
      false,
    );
    fireEvent.contextMenu(spacing);
    await user.click(await screen.findByRole("menuitem", { name: "Reset Group to Defaults" }));
    expect(onResetToDefault).toHaveBeenLastCalledWith(["padding"], "Spacing");

    spacing.focus();
    await user.keyboard("{Meta>}{Escape}{/Meta}");
    expect(onResetToDefault).toHaveBeenCalledTimes(2);
  });

  it("adds the app's actions for a group to its right-click menu, after its own (2.27)", async () => {
    const apply = vi.fn();
    const groupActions = vi.fn((id: string) =>
      id === "spacing"
        ? [
            { label: "Apply Look to Every Section on This Page", onSelect: apply },
            { label: "Apply Look to Every Section on the Site", enabled: false, onSelect: apply },
          ]
        : [],
    );
    render(
      <EditPanel
        heading="Section"
        fields={styleFields}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        groupActions={groupActions}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Style" }));

    fireEvent.contextMenu(screen.getByRole("button", { name: "Spacing" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Reset Group to Defaults",
      "Collapse All",
      "Apply Look to Every Section on This Page",
      "Apply Look to Every Section on the Site",
    ]);
    expect(items[3]?.getAttribute("aria-disabled")).toBe("true");
    await user.click(screen.getByRole("menuitem", { name: /on This Page/ }));
    expect(apply).toHaveBeenCalledOnce();
    expect(groupActions).toHaveBeenCalledWith("options");
  });

  it("shows only the fields whose name has the searched text, and Esc clears it (UX-13)", async () => {
    const { user } = renderStyle();
    const search = screen.getByRole("searchbox", { name: "Search options" });

    await user.type(search, "GA");
    expect(screen.queryByRole("radiogroup", { name: "Padding" })).toBeNull();
    expect(screen.getByLabelText("Gap")).toBeDefined();
    // The label keeps its name, with the part found marked, in its own case (SP-6).
    expect([...document.querySelectorAll("label mark")].map((mark) => mark.textContent)).toEqual([
      "Ga",
    ]);

    await user.clear(search);
    await user.type(search, "nothing like it");
    expect(screen.getByText("No options match your search.")).toBeDefined();

    await user.keyboard("{Escape}");
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("radiogroup", { name: "Padding" })).toBeDefined();
  });

  it("starts with every field shown for another element: the search was the last one's", async () => {
    const props = {
      heading: "Section",
      fields: styleFields,
      onChange: vi.fn(),
      onCommit: vi.fn(),
    };
    const { rerender } = render(<EditPanel {...props} itemKey="section-1" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search options" }), "gap");
    expect(screen.queryByRole("radiogroup", { name: "Padding" })).toBeNull();

    rerender(<EditPanel {...props} itemKey="section-2" />);

    expect(
      (screen.getByRole("searchbox", { name: "Search options" }) as HTMLInputElement).value,
    ).toBe("");
    expect(screen.getByRole("radiogroup", { name: "Padding" })).toBeDefined();
  });

  it("keeps each tab's groups apart, remembered by id in any language (UX-13)", async () => {
    const onClosedGroupsChange = vi.fn();
    const text = { id: "text", label: "Text" };
    render(
      <EditPanel
        heading="Heading"
        fields={[
          { name: "title", kind: "text", label: "Title", group: "content", value: "Hi" },
          {
            name: "bold",
            kind: "toggle",
            label: "Bold",
            group: "style",
            value: false,
            optionGroup: text,
          },
        ]}
        closedGroups={[]}
        onClosedGroupsChange={onClosedGroupsChange}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Style" }));

    await user.click(screen.getByRole("button", { name: "Text" }));

    // The Style tab's Text group, not the Content tab's of the same name.
    expect(onClosedGroupsChange).toHaveBeenLastCalledWith(["style:text"]);
  });

  it("shows a grey dot while a field uses Desktop's value on this device (UX-19)", () => {
    renderStyle({ responsive: true });

    expect(screen.getByRole("img", { name: "Padding: same as Desktop on Mobile" })).toBeDefined();
    expect(document.querySelectorAll("[data-device-dot]")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Use the Desktop value/ })).toBeNull();
  });

  it("shows a value set for this device with an accent dot, which clears it (UX-19)", async () => {
    const { onReset, user } = renderStyle({ responsive: true, overridden: true });

    const dot = screen.getByRole("button", {
      name: "Padding: set for Mobile only. Use the Desktop value instead",
    });
    expect(dot.getAttribute("data-device-dot")).toBe("set");
    await user.click(dot);

    expect(onReset).toHaveBeenCalledWith("padding");
  });

  it("shows no dot for a field that is the same on every device", () => {
    renderStyle();

    expect(document.querySelectorAll("[data-device-dot]")).toHaveLength(0);
  });
});

describe("box renderer (1.32)", () => {
  const tokens = [
    { label: "None", value: "none" },
    { label: "S", value: "s" },
    { label: "M", value: "m" },
  ];
  const sides = [
    { label: "Top", value: "top" },
    { label: "Right", value: "right" },
    { label: "Bottom", value: "bottom" },
    { label: "Left", value: "left" },
  ];

  function renderBox(value: unknown, fieldSides = sides) {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <EditPanel
        heading="Section"
        fields={[
          {
            name: "padding",
            kind: "box",
            label: "Padding",
            group: "style",
            value,
            options: tokens,
            sides: fieldSides,
          },
        ]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    return { onChange, onCommit, user: userEvent.setup() };
  }
  const choices = (name: string) => within(screen.getByRole("radiogroup", { name }));

  it("sets every side at once while they are the same, and Default unsets them", async () => {
    const { onChange, onCommit, user } = renderBox({});
    expect(
      screen
        .getByRole("switch", { name: "Padding Same on every side" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      choices("Padding").getByRole("radio", { name: "Default" }).getAttribute("aria-checked"),
    ).toBe("true");

    await user.click(choices("Padding").getByRole("radio", { name: "S" }));
    expect(onChange.mock.calls).toEqual([
      ["padding", { top: "s", right: "s", bottom: "s", left: "s" }],
    ]);
    expect(onCommit.mock.calls).toEqual([["padding"]]);
  });

  it("sets one side at a time, keeping the others", async () => {
    const { onChange, user } = renderBox({ top: "m", bottom: "m" });
    // Not the same on every side: a row per side.
    expect(screen.queryByRole("radiogroup", { name: "Padding" })).toBeNull();
    expect(
      choices("Padding Top").getByRole("radio", { name: "M" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      choices("Padding Left").getByRole("radio", { name: "Default" }).getAttribute("aria-checked"),
    ).toBe("true");

    await user.click(choices("Padding Left").getByRole("radio", { name: "None" }));
    await user.click(choices("Padding Top").getByRole("radio", { name: "Default" }));

    expect(onChange.mock.calls).toEqual([
      ["padding", { top: "m", bottom: "m", left: "none" }],
      ["padding", { bottom: "m" }],
    ]);
  });

  it("switches between every side and each side without changing anything", async () => {
    const { onChange, user } = renderBox({ top: "m", bottom: "m" });

    await user.click(screen.getByRole("switch", { name: "Padding Same on every side" }));

    // The sides differ, so no size is chosen until one is.
    expect(
      choices("Padding")
        .getAllByRole("radio")
        .filter((radio) => radio.getAttribute("aria-checked") === "true"),
    ).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the mode for its own changes, and starts afresh for sizes from elsewhere", async () => {
    const field = (value: unknown): EditPanelField => ({
      name: "padding",
      kind: "box",
      label: "Padding",
      group: "style",
      value,
      options: tokens,
      sides,
    });
    const onChange = vi.fn();
    const panel = (value: unknown) => (
      <EditPanel heading="Section" fields={[field(value)]} onChange={onChange} onCommit={vi.fn()} />
    );
    const view = render(panel({ top: "m", bottom: "m" }));
    const user = userEvent.setup();

    // One side made like the others keeps the rows the user is working in.
    await user.click(choices("Padding Left").getByRole("radio", { name: "M" }));
    view.rerender(panel({ top: "m", bottom: "m", left: "m" }));
    await user.click(choices("Padding Right").getByRole("radio", { name: "M" }));
    view.rerender(panel({ top: "m", right: "m", bottom: "m", left: "m" }));
    expect(choices("Padding Right")).toBeDefined();

    // Another element (or device) with the same size on every side: one row.
    view.rerender(panel({ top: "s", right: "s", bottom: "s", left: "s" }));
    expect(screen.queryByRole("radiogroup", { name: "Padding Top" })).toBeNull();
    expect(choices("Padding").getByRole("radio", { name: "S" }).getAttribute("aria-checked")).toBe(
      "true",
    );

    // And one with mixed sizes: a row per side, not every side at once.
    view.rerender(panel({ top: "none" }));
    expect(screen.queryByRole("radiogroup", { name: "Padding" })).toBeNull();
    expect(
      choices("Padding Top").getByRole("radio", { name: "None" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("starts afresh when Undo brings back the sizes before a change", async () => {
    const field = (value: unknown): EditPanelField => ({
      name: "padding",
      kind: "box",
      label: "Padding",
      group: "style",
      value,
      options: tokens,
      sides,
    });
    const panel = (value: unknown) => (
      <EditPanel heading="Section" fields={[field(value)]} onChange={vi.fn()} onCommit={vi.fn()} />
    );
    const view = render(panel({ top: "m", bottom: "m" }));
    const user = userEvent.setup();

    // Every side at once, then a size for them all.
    await user.click(screen.getByRole("switch", { name: "Padding Same on every side" }));
    await user.click(choices("Padding").getByRole("radio", { name: "S" }));
    view.rerender(panel({ top: "s", right: "s", bottom: "s", left: "s" }));
    expect(choices("Padding")).toBeDefined();

    // Undo: the mixed sizes again, so a row per side.
    view.rerender(panel({ top: "m", bottom: "m" }));
    expect(screen.queryByRole("radiogroup", { name: "Padding" })).toBeNull();
    expect(choices("Padding Top")).toBeDefined();
  });

  it("shows only the sides the field sets", () => {
    renderBox(
      { top: "s" },
      sides.filter((side) => side.value === "top" || side.value === "bottom"),
    );

    expect(choices("Padding Top")).toBeDefined();
    expect(choices("Padding Bottom")).toBeDefined();
    expect(screen.queryByRole("radiogroup", { name: "Padding Left" })).toBeNull();
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
      { id: "a", quote: "Lovely bread" },
      { id: "b", quote: "" },
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
      ["testimonials", { type: "move", id: "a", to: 1 }],
      ["testimonials", { type: "remove", id: "b" }],
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
      id: "a",
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
        fields={[{ ...testimonials, value: [{ id: "b", quote: "" }] }]}
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
        fields={[{ ...testimonials, value: [{ id: "new", quote: "" }] }]}
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
              { id: "0", name: "role" },
              { id: "1", name: "title" },
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

describe("hasBuiltInRenderer (2.20, B5)", () => {
  it("says which kinds every Edit panel draws, and which the app must give it", () => {
    expect(hasBuiltInRenderer("text")).toBe(true);
    expect(hasBuiltInRenderer("box")).toBe(true);
    expect(hasBuiltInRenderer("list")).toBe(true);
    expect(hasBuiltInRenderer("image")).toBe(false);
    expect(hasBuiltInRenderer("link")).toBe(false);
  });
});
