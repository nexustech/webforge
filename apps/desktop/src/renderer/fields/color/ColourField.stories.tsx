import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_PREFERENCES } from "../../../shared/ipc/prefs.js";
import { createPreferencesStore } from "../../shell/preferences-store.js";
import { sessionWith } from "../../testing/fixtures.js";
import { colourFieldRenderer } from "./ColourField.js";

// The Edit panel's colour field (1.37, UX-25, 2.20 B5), as the app draws it: the theme's colours as
// swatches, a shade and an opacity of the one chosen, and in Advanced mode a colour of its own.

const session = sessionWith();
const Simple = colourFieldRenderer({ session, preferences: createPreferencesStore() });
const Advanced = colourFieldRenderer({
  session,
  preferences: createPreferencesStore({
    preferences: { ...DEFAULT_PREFERENCES, editorLevel: "advanced" },
  }),
});

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

/** In Advanced mode, which also offers a colour of the field's own. */
export const AdvancedMode: Story = {
  render: (args) => (
    <div className="flex w-60 flex-col gap-1 border border-border-strong bg-panel p-2">
      <span id="field-colour-label" className="text-xs text-muted-foreground">
        Text colour
      </span>
      <Advanced {...args} />
    </div>
  ),
};
