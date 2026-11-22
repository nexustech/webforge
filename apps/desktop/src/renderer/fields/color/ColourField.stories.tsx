import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore } from "zustand/vanilla";
import { starterSite } from "../../../shared/starter-site.js";
import { sessionWith } from "../../testing/fixtures.js";
import { colourFieldRenderer } from "./ColourField.js";

// The Edit panel's colour field (1.37, UX-25, 2.20 B5), as the app draws it: the theme's colours as
// swatches, a shade and an opacity of the one chosen, and another colour of its own, in either mode
// (TC-2, #1219).

const session = sessionWith();
// A site with colours of its own in its theme (TC-1b), one of them chosen in a shade.
const withOwn = starterSite();
withOwn.theme.ownColors = [
  { id: "csky", name: "Harbour blue", color: { l: 0.62, c: 0.14, h: 240 } },
  { id: "cfern", name: "Fern", color: { l: 0.58, c: 0.13, h: 145 } },
];
const OwnColours = colourFieldRenderer({ session: sessionWith(withOwn) });
// A one-off used twice: offered as one of the person's colours (TC-3, #1221).
const Offering = colourFieldRenderer({
  session,
  toOwn: {
    uses: () => 2,
    add: async () => true,
    declined: createStore<readonly string[]>(() => []),
  },
});
const Simple = colourFieldRenderer({ session });

const meta = {
  title: "Edit/Fields/Colour",
  component: Simple,
  args: {
    id: "field-colour",
    labelId: "field-colour-label",
    field: {
      kind: "color",
      label: "Text colour",
      options: [
        { label: "Text colour", value: "default" },
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
        { label: "Accent", value: "accent" },
      ],
    },
    value: "primary",
    onChange: () => undefined,
    onCommit: () => undefined,
  },
  // As in the Edit panel: its label above, in the right column's width.
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-colour-label" className="text-xs text-muted-foreground">
        Text colour
      </span>
      <Simple {...args} />
    </div>
  ),
} satisfies Meta<typeof Simple>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One of the theme's colours, in Simple mode. */
export const ThemeColour: Story = {};

/** Nothing chosen: the element's own colour. */
export const NoneChosen: Story = { args: { value: undefined } };

/**
 * Another colour, in Simple mode (TC-2): a pale one-off, marked off the theme, hard to read on the
 * page, with the nearest shade of it that reads one click away.
 */
export const AnotherColour: Story = { args: { value: "[#f5d0c5]" } };

/** The person's own colours under *Your colours*, one chosen in a shade at an opacity (TC-1b). */
export const YourColours: Story = {
  args: { value: "own-csky-700/80" },
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-colour-label" className="text-xs text-muted-foreground">
        Text colour
      </span>
      <OwnColours {...args} />
    </div>
  ),
};

/**
 * A one-off used twice on the site, offered as one of the person's colours (TC-3, #1221): named
 * there and then, or *Not Now*.
 */
export const AddToYourColours: Story = {
  args: { value: "[#1f6feb]/50" },
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-colour-label" className="text-xs text-muted-foreground">
        Text colour
      </span>
      <Offering {...args} />
    </div>
  ),
};
