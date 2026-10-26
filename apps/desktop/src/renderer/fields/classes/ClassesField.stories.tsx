import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { CanvasApi } from "../../../shared/ipc/canvas.js";
import { dialogStory } from "../../testing/stories.js";
import { ClassesField } from "./ClassesField.js";

/** Classes a site's styles support, with the CSS each makes: a short stand-in for the worker's. */
const CLASSES: Readonly<Record<string, string>> = {
  "p-4": ".p-4 {\n  padding: calc(var(--spacing) * 4);\n}",
  "px-4": ".px-4 {\n  padding-inline: calc(var(--spacing) * 4);\n}",
  "bg-primary": ".bg-primary {\n  background-color: var(--color-primary);\n}",
  "bg-primary-content":
    ".bg-primary-content {\n  background-color: var(--color-primary-content);\n}",
  "bg-base-200": ".bg-base-200 {\n  background-color: var(--color-base-200);\n}",
  "text-primary": ".text-primary {\n  color: var(--color-primary);\n}",
  btn: ".btn {\n  display: inline-flex;\n  …\n}",
  flex: ".flex {\n  display: flex;\n}",
  "rounded-box": ".rounded-box {\n  border-radius: var(--radius-box);\n}",
  "shadow-lg": ".shadow-lg {\n  box-shadow: var(--shadow-lg);\n}",
};

const CANVAS: CanvasApi = {
  classCatalogue: () =>
    Promise.resolve({ status: "loaded", classes: Object.keys(CLASSES), variants: ["md", "hover"] }),
  classCss: (_theme, classes) =>
    Promise.resolve({ status: "css", css: classes.map((name) => CLASSES[name] ?? null) }),
  compileCss: () => Promise.resolve({ status: "failed" }),
};

/** The field, as the Edit panel's Advanced tab draws it, showing `value`. */
const field = (value: string) =>
  dialogStory((session) => (
    <div className="flex w-72 flex-col gap-1 border border-border-strong bg-panel p-2">
      <label id="classes-label" htmlFor="classes" className="text-xs text-muted-foreground">
        CSS classes
      </label>
      <ClassesField
        id="classes"
        labelId="classes-label"
        field={{ kind: "classes", label: "CSS classes", validate: () => undefined }}
        value={value}
        onChange={() => undefined}
        onCommit={() => undefined}
        session={session}
        canvas={() => CANVAS}
      />
    </div>
  ));

const meta = { title: "Edit/Fields/CSS classes" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Classes the element has. */
export const Classes: Story = field("shadow-lg rounded-box");

/** Suggestions as a class is typed: the site's classes that start with it. */
export const Suggestions: Story = {
  ...field("shadow-lg"),
  play: async ({ canvasElement }) => {
    const combobox = within(canvasElement).getByRole("combobox");
    const browse = within(canvasElement).getByRole("button", { name: "Browse classes…" });
    await waitFor(() => expect(browse).toBeEnabled());
    await userEvent.click(combobox);
    await userEvent.type(combobox, " bg-pri");
  },
};

/** A class that makes no style: a warning, with the closest that does. */
export const NoStyle: Story = field("shadow-lg pading-4");

/** The class browser, by category, each class previewed with the CSS it makes. */
export const Browse: Story = {
  ...field(""),
  play: async ({ canvasElement }) => {
    const browse = within(canvasElement).getByRole("button", { name: "Browse classes…" });
    // Once the classes have come.
    await waitFor(() => expect(browse).toBeEnabled());
    await userEvent.click(browse);
  },
};
