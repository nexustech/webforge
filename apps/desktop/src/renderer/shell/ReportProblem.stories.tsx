import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReportProblemDialog } from "./ReportProblem.js";

// Help › Report a Problem (5.23, OL-10): the person's message and what's sent with it, before
// anything leaves the app, which sends nothing itself.

/** A small grey picture standing in for a screenshot of the window. */
const SCREENSHOT =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#d4d4d8"/><rect x="0" y="0" width="640" height="32" fill="#a1a1aa"/></svg>',
  );

const noop = () => undefined;

const meta = {
  title: "Dialogs/Report a Problem",
  component: ReportProblemDialog,
  tags: ["full-window"],
  args: {
    open: true,
    onOpenChange: noop,
    info: { version: "0.3.0", system: "Windows 10.0.26300 (x64)", mail: false },
    text: "",
    onTextChange: noop,
    screenshot: null,
    status: null,
    onCopy: noop,
    onOpen: noop,
    onTakeScreenshot: noop,
    onSaveScreenshot: noop,
    onRemoveScreenshot: noop,
    onClear: noop,
  },
} satisfies Meta<typeof ReportProblemDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opened: nothing to send until there's a message. */
export const Empty: Story = {};

/** A message with its screenshot, the form opened in the browser. */
export const Written: Story = {
  args: {
    text: "The Add panel closed when I dragged a Gallery onto the page, and the Gallery wasn't added.",
    screenshot: SCREENSHOT,
    status: "opened-issue",
  },
};
