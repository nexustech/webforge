import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { EditPanel, type EditPanelField } from "./edit-panel.js";
import type { ListChange } from "./field-spec.js";

const meta = {
  title: "Edit/EditPanel",
  component: EditPanel,
  args: { fields: [], onChange: () => undefined, onCommit: () => undefined },
  decorators: [
    (Story) => (
      <div className="h-96 w-72 bg-panel">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const heroFields: EditPanelField[] = [
  { name: "title", kind: "text", label: "Title", group: "content", value: "Fresh ideas" },
  { name: "buttonLabel", kind: "text", label: "Button text", group: "content", value: "Contact" },
  {
    name: "alignment",
    kind: "select",
    label: "Alignment",
    group: "style",
    value: "centre",
    options: [
      { label: "Centre", value: "centre" },
      { label: "Left", value: "left" },
    ],
  },
];

/** Nothing selected on the canvas. */
export const Empty: Story = {};

/** A Hero selected: its text on Content, its alignment on Style. Changes are kept in the story. */
export const Hero: Story = {
  render: () => {
    const [fields, setFields] = useState(heroFields);
    return (
      <EditPanel
        heading="Hero"
        fields={fields}
        onChange={(name, value) =>
          setFields((current) =>
            current.map((field) => (field.name === name ? { ...field, value } : field)),
          )
        }
        onCommit={() => undefined}
      />
    );
  },
};

/**
 * A section's overlay too weak for its text over some images: the warning sits under the slider,
 * above its help, and never blocks the change (2.26).
 */
export const OverlayWarning: Story = {
  args: {
    heading: "Text",
    fields: [
      {
        name: "overlay",
        kind: "slider",
        label: "Overlay",
        group: "style",
        value: "20",
        steps: [
          { label: "None", value: "0" },
          { label: "Light", value: "20" },
          { label: "Medium", value: "40" },
          { label: "Strong", value: "60" },
          { label: "Very strong", value: "80" },
        ],
        help: "A layer of colour over the image, so the text stays easy to read.",
        warning:
          "The text may be hard to read on some images: its contrast can fall to 2.1:1, below the 4.5:1 most people need. Choose a stronger overlay.",
      },
    ],
  },
};

/** A select in the Appearance group, with where its value comes from (CT-3). */
const appearance = (
  name: string,
  label: string,
  value: string,
  source: EditPanelField["source"],
): EditPanelField => ({
  name,
  kind: "select",
  label,
  group: "style",
  value,
  options: [
    { label: "Theme's", value: "default" },
    { label: "None", value: "none" },
    { label: "Large", value: "large" },
    { label: "Full", value: "full" },
  ],
  optionGroup: { id: "appearance", label: "Appearance" },
  ...(source === undefined ? {} : { source }),
});

/**
 * Where each Appearance value comes from (3.12, CT-3): the element's own, here or on the device
 * shown; a class of its own; its kind's look and the theme's token, each a link that shows it.
 */
export const Provenance: Story = {
  args: {
    heading: "Button",
    fields: [
      appearance("lookCorners", "Corners", "default", {
        text: "Theme's (Corners: Medium)",
        onReveal: () => undefined,
      }),
      appearance("lookShadow", "Shadow", "large", {
        text: "Theme's look for Button",
        onReveal: () => undefined,
      }),
      appearance("lookBorder", "Border", "none", { text: "Set here" }),
      appearance("lookOpacity", "Opacity", "full", { text: "Set on Mobile" }),
      appearance("lookBackground", "Background", "default", { text: "Class (Advanced)" }),
    ],
  },
};

/** An element with only style fields starts on the Style tab. */
export const StyleOnly: Story = {
  args: { heading: "Section", fields: heroFields.filter((field) => field.group === "style") },
};

const sizes = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
];

/**
 * A Section seen on Mobile: a padding set for Mobile only (its dot in the accent colour, its group
 * changed), a slider using Desktop's value (a grey dot), a switch the same on every device.
 */
export const StyleFields: Story = {
  render: () => {
    const [fields, setFields] = useState<EditPanelField[]>([
      {
        name: "padding",
        kind: "spacing",
        label: "Padding",
        group: "style",
        value: "small",
        options: sizes,
        responsive: true,
        overridden: true,
        changed: true,
      },
      {
        name: "gap",
        kind: "slider",
        label: "Space between elements",
        group: "style",
        value: "medium",
        steps: sizes,
        responsive: true,
      },
      { name: "fullWidth", kind: "toggle", label: "Full width", group: "style", value: false },
    ]);
    const set = (
      name: string,
      change: Partial<Pick<EditPanelField, "value" | "changed" | "responsive" | "overridden">>,
    ) =>
      setFields((current) =>
        current.map((field) => (field.name === name ? { ...field, ...change } : field)),
      );
    return (
      <EditPanel
        heading="Section"
        device="Mobile"
        fields={fields}
        onChange={(name, value) => set(name, { value, overridden: true, changed: true })}
        onCommit={() => undefined}
        onReset={(name) => set(name, { value: "medium", overridden: false, changed: false })}
        onResetToDefault={(names) => {
          for (const name of names)
            set(name, { value: "medium", overridden: false, changed: false });
        }}
      />
    );
  },
};

/**
 * The Style tab in a 240 px column (#278): every row keeps its label and control side by side, a
 * long label cut short with its full name in its tooltip, and every control reachable by Tab.
 */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
  args: {
    heading: "Section",
    device: "Mobile",
    fields: [
      {
        name: "padding",
        kind: "spacing",
        label: "Padding",
        group: "style",
        value: "small",
        options: sizes,
        responsive: true,
      },
      {
        name: "gap",
        kind: "slider",
        label: "Space between elements",
        group: "style",
        value: "medium",
        steps: sizes,
      },
      { name: "fullWidth", kind: "toggle", label: "Full width", group: "style", value: false },
      {
        name: "alignment",
        kind: "select",
        label: "Alignment",
        group: "style",
        value: "centre",
        options: [
          { label: "Centre", value: "centre" },
          { label: "Left", value: "left" },
        ],
      },
    ],
  },
};

/**
 * The space between elements on each device (SP-5), the Section seen on Mobile: Desktop's value,
 * Tablet's own (its name in the accent), and Mobile taking Tablet's (the dot on Tablet).
 */
export const PerDevice: Story = {
  args: {
    heading: "Section",
    device: "Mobile",
    onChangeOn: () => undefined,
    fields: [
      {
        name: "gap",
        kind: "slider",
        label: "Space between elements",
        group: "style",
        value: "small",
        steps: sizes,
        responsive: true,
        devices: [
          { id: "desktop", label: "Desktop", value: "large", own: true, inEffect: false },
          { id: "tablet", label: "Tablet", value: "small", own: true, inEffect: true },
          { id: "mobile", label: "Mobile", value: "small", own: false, inEffect: false },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Space between elements on each device" }),
    );
  },
};

/**
 * Searching for "pad" (SP-6): the matching part of each label is marked, and a group's header
 * shows its copy, paste and reset buttons while hovered or focused (SP-7).
 */
export const SearchAndGroupActions: Story = {
  args: {
    heading: "Section",
    onPaste: () => undefined,
    onResetToDefault: () => undefined,
    fields: [
      {
        name: "padding",
        kind: "spacing",
        label: "Padding",
        group: "style",
        value: "small",
        options: sizes,
        changed: true,
      },
      { name: "fullWidth", kind: "toggle", label: "Full width", group: "style", value: false },
    ],
  },
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement);
    await userEvent.type(panel.getByRole("searchbox", { name: "Search options" }), "pad");
    panel.getByRole("button", { name: "Copy Spacing" }).focus();
  },
};

const tokens = ["None", "S", "M", "L", "XL"].map((label) => ({
  label,
  value: label.toLowerCase(),
}));
const sides = ["Top", "Right", "Bottom", "Left"].map((label) => ({
  label,
  value: label.toLowerCase(),
}));

/**
 * A Section's padding and margin per side (1.32): padding set on two sides, so a row per side;
 * the margin above and below the same, so one row for both.
 */
export const BoxSpacing: Story = {
  render: () => {
    const [fields, setFields] = useState<EditPanelField[]>([
      {
        name: "padding",
        kind: "box",
        label: "Padding",
        group: "style",
        value: { top: "l", bottom: "l" },
        options: tokens,
        sides,
      },
      {
        name: "margin",
        kind: "box",
        label: "Margin",
        group: "style",
        value: {},
        options: tokens,
        sides: sides.filter((side) => side.value === "top" || side.value === "bottom"),
      },
    ]);
    return (
      <EditPanel
        heading="Section"
        fields={fields}
        onChange={(name, value) =>
          setFields((current) =>
            current.map((field) => (field.name === name ? { ...field, value } : field)),
          )
        }
        onCommit={() => undefined}
      />
    );
  },
};

/** A repeating list: a row per testimonial, the open one's fields below it (F-ED-6). */
export const RepeatingList: Story = {
  render: () => {
    const [items, setItems] = useState([
      { id: "a", quote: "The best bread in town", author: "Sam" },
      { id: "b", quote: "Friendly and fast", author: "Alex" },
      { id: "c", quote: "", author: "" },
    ]);
    return (
      <EditPanel
        heading="Testimonials"
        fields={[
          {
            name: "testimonials",
            kind: "list",
            label: "Testimonials",
            group: "content",
            itemLabel: "Testimonial",
            itemFields: [
              { name: "quote", kind: "text", label: "Quote" },
              { name: "author", kind: "text", label: "Name" },
            ],
            value: items,
          },
        ]}
        onChange={(_name, change) => {
          const listChange = change as ListChange;
          setItems((current) => {
            switch (listChange.type) {
              case "add":
                return [...current, { id: String(current.length + 1), quote: "", author: "" }];
              case "remove":
                return current.filter((item) => item.id !== listChange.id);
              case "move": {
                const moved = current.find((item) => item.id === listChange.id);
                const rest = current.filter((item) => item.id !== listChange.id);
                return moved === undefined
                  ? current
                  : [...rest.slice(0, listChange.to), moved, ...rest.slice(listChange.to)];
              }
              case "edit":
                return current.map((item) =>
                  item.id === listChange.id
                    ? { ...item, [listChange.name]: listChange.value }
                    : item,
                );
            }
          });
        }}
        onCommit={() => undefined}
      />
    );
  },
};

/** The Advanced tab (Advanced mode): CSS classes, the anchor and attributes, checked as typed. */
export const AdvancedTab: Story = {
  args: {
    heading: "Heading",
    advanced: true,
    fields: [
      {
        name: "className",
        kind: "text",
        label: "CSS classes",
        group: "advanced",
        placeholder: "e.g. shadow-lg rounded-box",
        value: "italic",
      },
      {
        name: "anchorId",
        kind: "text",
        label: "Anchor ID",
        group: "advanced",
        placeholder: "e.g. opening-times",
        value: "",
        validate: (value) =>
          /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
            ? undefined
            : "Use lowercase letters, digits and single hyphens, starting with a letter",
      },
      {
        name: "attributes",
        kind: "list",
        label: "Attributes",
        group: "advanced",
        itemLabel: "Attribute",
        orderless: true,
        itemFields: [
          { name: "name", kind: "text", label: "Name" },
          { name: "value", kind: "text", label: "Value" },
        ],
        value: [{ id: "0", name: "data-track", value: "hero" }],
      },
    ],
  },
};
