import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon, PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CommandButton } from "./CommandButton.js";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { type CommandSpec, createCommandRegistry } from "./commands.js";
import { ModeToggle } from "./ModeToggle.js";
import { PanelRegistryProvider } from "./panel-context.js";
import { createPanelRegistry, type Panel } from "./panels.js";
import { ShellLayout } from "./ShellLayout.js";
import { TitleBar } from "./TitleBar.js";

// The UI1 parity story: the whole window as Bootstrap Studio users know its layout, with sample
// panels standing in for the ones later items add (Add, Layers, Edit, Site, Site Check).

const noop = () => undefined;

const COMMANDS: readonly CommandSpec[] = [
  { id: COMMAND_IDS.newSite, label: "New Site…", menu: "file", run: noop },
  { id: COMMAND_IDS.openSite, label: "Open Site…", menu: "file", run: noop },
  { id: COMMAND_IDS.undo, label: "Undo", menu: "edit", run: noop },
  { id: COMMAND_IDS.redo, label: "Redo", menu: "edit", enabled: false, run: noop },
  { id: COMMAND_IDS.preview, label: "Preview", menu: "file", run: noop },
  { id: COMMAND_IDS.exportSite, label: "Export Site…", menu: "file", run: noop },
  { id: COMMAND_IDS.publish, label: "Publish…", menu: "file", run: noop },
];

function Placeholder({ children }: { readonly children: ReactNode }) {
  return <div className="p-2 text-xs text-muted-foreground">{children}</div>;
}

function List({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="p-1">
      {items.map((item, index) => (
        <li
          key={item}
          className={`flex h-6 items-center rounded-sm px-2 text-xs ${index === 1 ? "bg-accent" : ""}`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

const PANELS: readonly Panel[] = [
  {
    id: "add",
    slot: "left.top",
    title: "Add",
    component: () => <List items={["Headers", "Heroes", "Features", "Pricing", "Contact"]} />,
  },
  {
    id: "history",
    slot: "left.bottom",
    title: "Undo History",
    component: () => <List items={["Edited Heading text", "Added Hero", "Opened page"]} />,
  },
  {
    // Always shown under Add and Undo History (ADR 0011).
    id: "layers",
    slot: "left.lower",
    title: "Layers",
    component: () => <List items={["Header", "Hero", "Heading", "Text", "Footer"]} />,
  },
  {
    id: "edit",
    slot: "right.top",
    title: "Edit",
    component: () => (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Select an element to edit it
      </div>
    ),
  },
  {
    id: "site",
    slot: "right.bottom",
    title: "Site",
    component: () => <List items={["Home", "About", "Contact"]} />,
  },
  {
    id: "theme",
    slot: "right.bottom",
    title: "Theme",
    component: () => <Placeholder>Theme</Placeholder>,
  },
  {
    id: "check",
    slot: "drawer",
    title: "Site Check",
    component: () => <Placeholder>All good</Placeholder>,
  },
];

function Window() {
  const [commands] = useState(() => {
    const registry = createCommandRegistry();
    for (const command of COMMANDS) registry.register(command);
    return registry;
  });
  const [panels] = useState(() => {
    const registry = createPanelRegistry();
    for (const panel of PANELS) registry.register(panel);
    return registry;
  });
  return (
    <CommandRegistryProvider registry={commands}>
      <PanelRegistryProvider registry={panels}>
        <div className="flex h-screen flex-col">
          <TitleBar
            siteName="Bloom Bakery"
            saveStatus={
              <span className="flex items-center gap-1 px-1 text-xs text-save-status">
                <CheckIcon className="size-3.5" />
                Saved
              </span>
            }
            tools={
              <>
                <ModeToggle mode="design" onModeChange={noop} />
                <div className="mx-1 h-5 w-px bg-border" aria-hidden />
                <CommandButton
                  commandId={COMMAND_IDS.toggleLeftPanels}
                  icon={<PanelLeftIcon />}
                  label="Left panels"
                />
                <CommandButton
                  commandId={COMMAND_IDS.toggleDrawer}
                  icon={<PanelBottomIcon />}
                  label="Bottom panel"
                />
                <CommandButton
                  commandId={COMMAND_IDS.toggleRightPanels}
                  icon={<PanelRightIcon />}
                  label="Right panels"
                />
              </>
            }
          />
          <main className="min-h-0 flex-1">
            <ShellLayout
              layout={{}}
              onLayoutChange={noop}
              editorLevel="simple"
              center={
                // The page flush at the top of the flat backdrop, with no shadow (LF-2).
                <div className="flex h-full items-start justify-center px-6">
                  <div className="h-3/4 w-3/4 bg-white" />
                </div>
              }
            />
          </main>
        </div>
      </PanelRegistryProvider>
    </CommandRegistryProvider>
  );
}

const meta = {
  title: "Shell/Window",
  component: Window,
  // e2e/visual screenshots stories tagged full-window at 1280×800.
  tags: ["full-window"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Window>;

export default meta;
type Story = StoryObj<typeof meta>;

/** UI1 parity: title bar, Add and Undo History left, the canvas, Edit and Site right. */
export const Parity: Story = {};
