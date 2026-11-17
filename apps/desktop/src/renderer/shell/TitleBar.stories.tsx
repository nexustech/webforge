import type { Meta, StoryObj } from "@storybook/react-vite";
import type { HistoryState } from "@webforge/history";
import { CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { userEvent, within } from "storybook/test";
import { createStore } from "zustand/vanilla";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type CommandSpec, createCommandRegistry } from "./commands.js";
import { TitleBar } from "./TitleBar.js";
import { UndoStepsMenu } from "./UndoStepsMenu.js";

const noop = () => undefined;

/** The commands the title bar shows once every area has contributed its own. */
const COMMANDS: readonly CommandSpec[] = [
  {
    id: COMMAND_IDS.newSite,
    label: "New Site…",
    menu: "file",
    run: noop,
  },
  {
    id: COMMAND_IDS.openSite,
    label: "Open Site…",
    menu: "file",
    run: noop,
  },
  { id: COMMAND_IDS.undo, label: "Undo", menu: "edit", run: noop },
  {
    id: COMMAND_IDS.redo,
    label: "Redo",
    menu: "edit",
    enabled: false,
    run: noop,
  },
  // What Site Check found (#1009).
  { id: COMMAND_IDS.siteCheck, label: "Site Check", status: "5 to fix · 13 tips", run: noop },
  { id: COMMAND_IDS.preview, label: "Preview", menu: "file", run: noop },
  { id: COMMAND_IDS.exportSite, label: "Export Site…", menu: "file", run: noop },
  { id: COMMAND_IDS.publish, label: "Publish…", menu: "file", run: noop },
];

function WithCommands({
  commands,
  undoSteps,
  width,
}: {
  readonly commands: readonly CommandSpec[];
  readonly undoSteps?: ReactNode;
  /** The window's width, in pixels: the story's own otherwise. */
  readonly width?: number;
}) {
  const [registry] = useState(() => {
    const created = createCommandRegistry();
    for (const command of commands) created.register(command);
    return created;
  });
  return (
    <CommandRegistryProvider registry={registry}>
      <div style={width === undefined ? undefined : { width }}>
        <TitleBar
          siteName="Bloom Bakery"
          undoSteps={undoSteps}
          saveStatus={
            <span className="flex items-center gap-1 px-1 text-xs text-save-status">
              <CheckIcon className="size-3.5" />
              Saved
            </span>
          }
        />
      </div>
    </CommandRegistryProvider>
  );
}

const meta = {
  title: "Shell/TitleBar",
  component: TitleBar,
  parameters: { layout: "fullscreen" },
  args: { siteName: "Bloom Bakery" },
} satisfies Meta<typeof TitleBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every area has contributed its commands (Redo has nothing to redo). */
export const Complete: Story = {
  render: () => <WithCommands commands={COMMANDS} />,
};

const START = new Set<string>([COMMAND_IDS.newSite, COMMAND_IDS.openSite]);

/** The start screen: no site open, so no Undo, Redo, Site Check, Preview, Export or Publish (#1009). */
export const StartScreen: Story = {
  render: () => <WithCommands commands={COMMANDS.filter((command) => START.has(command.id))} />,
};

/** A 960 px window: Site Check, Preview, Export and Publish are icons, nothing cut off (#1009). */
export const At960: Story = {
  tags: ["wide-window"],
  render: () => <WithCommands commands={COMMANDS} width={960} />,
};

/**
 * A 1280 px window: Site Check shows what it found, and Preview, Export and Publish their names,
 * Publish filled (#1009).
 */
export const At1280: Story = {
  tags: ["wide-window"],
  render: () => <WithCommands commands={COMMANDS} width={1280} />,
};

/** A 1440 px window: their names, with room to spare (#1009). */
export const At1440: Story = {
  tags: ["wide-window"],
  render: () => <WithCommands commands={COMMANDS} width={1440} />,
};

/** Site Check found nothing to fix and no tips (#1009). */
export const NoProblems: Story = {
  tags: ["wide-window"],
  render: () => (
    <WithCommands
      commands={COMMANDS.map((command) =>
        command.id === COMMAND_IDS.siteCheck ? { ...command, status: "No problems" } : command,
      )}
      width={1280}
    />
  ),
};

/** A phone can open the preview (3.2): the cue says so, with Stop beside it. */
export const PhonePreviewOn: Story = {
  render: () => (
    <WithCommands
      commands={[
        ...COMMANDS,
        {
          id: COMMAND_IDS.stopPhonePreview,
          label: "Stop Phone Preview",
          menu: "file",
          run: noop,
        },
      ]}
    />
  ),
};

/**
 * A command that goes with Export (LF-13), as ZIP export will (3.3): Export becomes a split
 * button, its caret open.
 */
export const SplitButton: Story = {
  render: () => (
    <WithCommands
      commands={[
        ...COMMANDS,
        { id: "site.exportZip", label: "Export as ZIP…", more: COMMAND_IDS.exportSite, run: noop },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "More Export options" }),
    );
  },
};

/** Opens File › Open Recent, from the keyboard as the arrow key opens a submenu. */
const openRecent = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("menuitem", { name: "File" }));
  // The menus are in a portal on the body; the arrow key opens the submenu.
  const page = within(canvasElement.ownerDocument.body);
  page.getByRole("menuitem", { name: "Open Recent" }).focus();
  await userEvent.keyboard("{ArrowRight}");
  await page.findByRole("menu", { name: "Open Recent" });
};

/** File › Open Recent open (3.18): the latest sites, the folder where two share a name. */
export const OpenRecent: Story = {
  render: () => (
    <WithCommands
      commands={[
        ...COMMANDS.slice(0, 2),
        { id: COMMAND_IDS.openRecent, label: "Open Recent", menu: "file", run: noop },
        ...["Bloom Bakery (Sites)", "Bloom Bakery (Old sites)", "Rosa's Florist", "Sam Lee"].map(
          (label, index) => ({
            id: `${COMMAND_IDS.openRecent}.${String(index).repeat(32)}`,
            label,
            submenu: COMMAND_IDS.openRecent,
            run: noop,
          }),
        ),
        {
          id: COMMAND_IDS.clearRecent,
          label: "Clear Recent",
          submenu: COMMAND_IDS.openRecent,
          separated: true,
          run: noop,
        },
        ...COMMANDS.slice(2),
      ]}
    />
  ),
  play: openRecent,
};

/** No recent sites yet: the submenu says so, its one item off. */
export const OpenRecentEmpty: Story = {
  render: () => (
    <WithCommands
      commands={[
        ...COMMANDS.slice(0, 2),
        { id: COMMAND_IDS.openRecent, label: "Open Recent", menu: "file", run: noop },
        {
          id: COMMAND_IDS.noRecent,
          label: "No Recent Sites",
          submenu: COMMAND_IDS.openRecent,
          enabled: false,
          run: noop,
        },
      ]}
    />
  ),
  play: openRecent,
};

/** A site's steps so far; the last was undone. */
const STEPS = createStore<HistoryState<unknown>>()(() => ({
  entries: [
    "Opened page",
    "Added Hero",
    "Edited Hero title",
    "Changed Hero padding",
    "Added Text",
    "Deleted Heading",
  ].map((label, index) => ({
    id: `step-${index}`,
    label,
    forward: [],
    inverse: [],
    coalesceKey: null,
    selectionBefore: null,
    selectionAfter: null,
    createdAt: 0,
    updatedAt: 0,
  })),
  cursor: 5,
  canUndo: true,
  canRedo: true,
  transaction: null,
}));

/** The arrow beside Undo open: the latest steps to undo back to (UX-16). */
export const UndoSteps: Story = {
  render: () => (
    <WithCommands
      commands={COMMANDS}
      undoSteps={<UndoStepsMenu state={STEPS} undoTo={() => true} />}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Undo several steps" }),
    );
  },
};

/** The palette open (Ctrl/Cmd+P): commands, pages to go to and things to add (UX-11). */
export const Palette: Story = {
  render: () => (
    <WithCommands
      commands={[
        ...COMMANDS,
        { id: "page.goto.home", label: "Home", palette: "pages", keywords: ["index"], run: noop },
        { id: "page.goto.about", label: "About", palette: "pages", keywords: ["about"], run: noop },
        { id: "add.item.Hero", label: "Add Hero", palette: "add", run: noop },
        { id: "add.item.Text", label: "Add Text", palette: "add", enabled: false, run: noop },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Search commands/ }));
  },
};
