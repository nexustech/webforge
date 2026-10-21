import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { EditPanel, type EditPanelField } from "./edit-panel.js";
import type { ListChange } from "./field-registry.js";

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

/** An element with only style fields starts on the Style tab. */
export const StyleOnly: Story = {
  args: { heading: "Section", fields: heroFields.filter((field) => field.group === "style") },
};

const sizes = [
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
];

/** A Section seen on Mobile: a padding set for Mobile only, a slider, a switch. */
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
        overridden: true,
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
    ]);
    const set = (name: string, change: Partial<EditPanelField>) =>
      setFields((current) =>
        current.map((field) => (field.name === name ? { ...field, ...change } : field)),
      );
    return (
      <EditPanel
        heading="Section"
        device="Mobile"
        fields={fields}
        onChange={(name, value) => set(name, { value, overridden: true })}
        onCommit={() => undefined}
        onReset={(name) => set(name, { value: "medium", overridden: false })}
      />
    );
  },
};

/** A repeating list: a row per testimonial, the open one's fields below it (F-ED-6). */
export const RepeatingList: Story = {
  render: () => {
    const [items, setItems] = useState([
      { key: "a", values: { quote: "The best bread in town", author: "Sam" } },
      { key: "b", values: { quote: "Friendly and fast", author: "Alex" } },
      { key: "c", values: { quote: "", author: "" } },
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
                return [
                  ...current,
                  { key: String(current.length + 1), values: { quote: "", author: "" } },
                ];
              case "remove":
                return current.filter((item) => item.key !== listChange.key);
              case "move": {
                const moved = current.find((item) => item.key === listChange.key);
                const rest = current.filter((item) => item.key !== listChange.key);
                return moved === undefined
                  ? current
                  : [...rest.slice(0, listChange.to), moved, ...rest.slice(listChange.to)];
              }
              case "edit":
                return current.map((item) =>
                  item.key === listChange.key
                    ? { ...item, values: { ...item.values, [listChange.name]: listChange.value } }
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
        itemFields: [
          { name: "name", kind: "text", label: "Name" },
          { name: "value", kind: "text", label: "Value" },
        ],
        value: [{ key: "0", values: { name: "data-track", value: "hero" } }],
      },
    ],
  },
};
