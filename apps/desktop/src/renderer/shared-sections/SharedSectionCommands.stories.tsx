import type { Meta, StoryObj } from "@storybook/react-vite";
import { dialogStory } from "../testing/stories.js";
import { SharedSectionNameDialog } from "./SharedSectionCommands.js";

// The dialog that names a shared section (F-ED-23), to save the selected section as one or to
// rename one (2.20, B6).
const meta = { title: "Dialogs/SharedSectionName" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const close = () => undefined;

/** Saving the selected section as a shared section, its name suggested. */
export const Save: Story = dialogStory((session) => (
  <SharedSectionNameDialog
    session={session}
    naming={{ kind: "save", suggested: "Opening hours" }}
    onClose={close}
  />
));
