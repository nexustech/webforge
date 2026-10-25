import type { Meta, StoryObj } from "@storybook/react-vite";
import { z } from "zod";
import { FormDialog } from "./form-dialog.js";
import type { FormSpec, FormValues } from "./form-spec.js";

/** A device's name and size, checked as the person types, as *Add device…* is. */
const device: FormSpec<FormValues, unknown> = {
  fields: [
    { kind: "text", name: "name", label: "Name", maxLength: 40 },
    { kind: "number", name: "width", label: "Width in pixels", min: 320, max: 2560, width: "sm" },
  ],
  schema: z.object({
    name: z.string().trim().min(1, "Fill this in."),
    width: z.coerce.number().int().min(320, "Use 320 or more.").max(2560, "Use 2560 or less."),
  }),
  toModel: (values) => values,
  validateOn: "change",
};

/** Site settings on tabs, checked when Save is pressed, as Site Settings are. */
const settings: FormSpec<FormValues, unknown> = {
  groups: [
    { id: "general", label: "General" },
    { id: "contact", label: "Contact & hours" },
  ],
  fields: [
    { kind: "text", name: "name", label: "Site name", group: "general" },
    { kind: "text", name: "description", label: "Description", group: "general", multiline: true },
    { kind: "toggle", name: "backToTop", label: "Show a back-to-top button", group: "general" },
    { kind: "text", name: "email", label: "Email", group: "contact", inputType: "email" },
  ],
  schema: z.object({
    name: z.string().max(10, "Use at most 10 characters."),
    email: z.email("Use an email address, such as name@example.com.").or(z.literal("")),
  }),
  toModel: (values) => values,
};

const meta = {
  title: "Base/FormDialog",
  component: FormDialog,
  args: {
    open: true,
    title: "Add a device",
    description: "A screen size to show the page at, on every site.",
    confirm: "Add Device",
    spec: device,
    initial: { name: "", width: "" },
    onSave: () => undefined,
    onCancel: () => undefined,
  },
  // A dialog is drawn outside the story's root: give it a window's room.
  tags: ["full-window"],
} satisfies Meta<typeof FormDialog<FormValues, unknown>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opened empty: nothing is wrong yet, and Add stays off until the device is described. */
export const Empty: Story = {};

/** Checked as the person types: the problem shows on the field they changed. */
export const InvalidWhileTyping: Story = {
  args: { initial: { name: "Kiosk", width: "" } },
  play: async ({ canvasElement }) => {
    const width = canvasElement.ownerDocument.querySelector<HTMLInputElement>("input[type=number]");
    if (width === null) throw new Error("No width field");
    // As typing does: the value, then the event React listens for.
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    set?.call(width, "5000");
    width.dispatchEvent(new Event("input", { bubbles: true }));
  },
};

/** Checked when Save is pressed: the problems on their fields, the tab with one marked. */
export const InvalidOnSave: Story = {
  args: {
    title: "Site Settings",
    description: "Details that apply to the whole site, wherever they appear.",
    confirm: "Save",
    spec: settings,
    initial: {
      name: "Rosa's Bakery and Café",
      description: "",
      backToTop: true,
      email: "rosa",
    },
    groupsLabel: "Site Settings sections",
    size: "lg",
  },
  play: ({ canvasElement }) => {
    canvasElement.ownerDocument.querySelector<HTMLButtonElement>("button[type=submit]")?.click();
  },
};

/** More fields than the window is high: the dialog scrolls, its buttons with it. */
export const LongContent: Story = {
  args: {
    title: "Site Settings",
    confirm: "Save",
    spec: {
      ...settings,
      groups: [],
      fields: Array.from({ length: 14 }, (_, index) => ({
        kind: "text" as const,
        name: `field${index}`,
        label: `Field ${index + 1}`,
      })),
      schema: z.unknown(),
    },
    initial: {},
  },
};
