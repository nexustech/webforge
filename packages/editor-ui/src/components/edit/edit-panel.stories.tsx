import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { EditPanel, type EditPanelField } from "./edit-panel.js";

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
