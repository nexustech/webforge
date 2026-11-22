import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OwnColor } from "@webforge/model";
import { StudioOneOffColours } from "./StudioOneOffColours.js";

// Theme Studio's Colours outside your theme (5.32, TC-4): every one-off the site uses, where, and
// what can be done with each.

const SKY: OwnColor = { id: "csky", name: "Harbour blue", color: { l: 0.62, c: 0.14, h: 240 } };

const meta = {
  title: "Dialogs/Theme Studio/Colours outside your theme",
  component: StudioOneOffColours,
  args: {
    colours: [],
    own: [SKY],
    nearest: () => SKY,
    onAdd: async () => true,
    onUseNearest: () => undefined,
    onShow: () => undefined,
  },
  render: (args) => (
    <div className="w-[44rem] bg-panel p-3">
      <StudioOneOffColours {...args} />
    </div>
  ),
} satisfies Meta<typeof StudioOneOffColours>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One-offs in use, the most used first, each with where it's used. */
export const Some: Story = {
  args: {
    colours: [
      {
        hex: "#1f6feb",
        uses: [
          { key: "a", where: "Heading on Home", canShow: true },
          { key: "b", where: "Button in the Header", canShow: true },
          { key: "c", where: "Icon list in the shared section Opening hours", canShow: false },
        ],
      },
      { hex: "#c0392b", uses: [{ key: "d", where: "Text on About", canShow: true }] },
    ],
  },
};

/** None: the site uses its theme's colours only. */
export const None: Story = {};
