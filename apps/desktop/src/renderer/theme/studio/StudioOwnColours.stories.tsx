import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OwnColor } from "@webforge/model";
import { userEvent, within } from "storybook/test";
import { StudioOwnColours } from "./StudioOwnColours.js";

// Theme Studio › Colours' list of the person's own colours (TC-1b, #1218).

const COLOURS: readonly OwnColor[] = [
  { id: "csky", name: "Harbour blue", color: { l: 0.62, c: 0.14, h: 240 } },
  { id: "cfern", name: "Fern", color: { l: 0.58, c: 0.13, h: 145 } },
  { id: "cclay", name: "Terracotta", color: { l: 0.6, c: 0.14, h: 40 } },
];

const meta = {
  title: "Dialogs/Theme Studio/Your colours",
  component: StudioOwnColours,
  args: {
    colors: COLOURS,
    startColor: { l: 0.45, c: 0.24, h: 277 },
    onAdd: () => undefined,
    onRename: () => undefined,
    onSetColor: () => undefined,
    usesOf: (id: string) => (id === "csky" ? 3 : 0),
    onDelete: () => undefined,
  },
  // In Theme Studio's column width.
  render: (args) => (
    <div className="w-[44rem] bg-panel p-3">
      <StudioOwnColours {...args} />
    </div>
  ),
} satisfies Meta<typeof StudioOwnColours>;

export default meta;
type Story = StoryObj<typeof meta>;

/** None yet: what the list is for, and its Add button. */
export const None: Story = { args: { colors: [] } };

/** A few colours, each with its colour, its name and Delete; a pale one hard to read as text. */
export const Some: Story = {
  args: {
    colors: [...COLOURS, { id: "csand", name: "Sand", color: { l: 0.85, c: 0.05, h: 85 } }],
    issues: [{ palette: "colors", id: "csand", background: "base-100", ratio: 1.42, required: 3 }],
  },
};

/** A long list, searched by name. */
export const Searched: Story = {
  args: {
    colors: [
      ...COLOURS,
      { id: "csand", name: "Sand", color: { l: 0.85, c: 0.05, h: 85 } },
      { id: "cnight", name: "Night", color: { l: 0.25, c: 0.05, h: 260 } },
      { id: "crose", name: "Rose", color: { l: 0.7, c: 0.12, h: 10 } },
    ],
  },
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole("searchbox", { name: "Find a colour by name" }),
      "fern",
    );
  },
};

/** Deleting a colour in use: give its uses to another colour, or keep each as it looks. */
export const DeletingOneInUse: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete Harbour blue" }),
    );
    await within(document.body).findByRole("alertdialog", { name: "Delete 'Harbour blue'?" });
  },
};
