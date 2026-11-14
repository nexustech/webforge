import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import type { McpApi, McpStatus } from "../../shared/ipc/mcp.js";
import { AiAppsDialog } from "./AiAppsDialog.js";

/** AI apps on, with one app connected and one whose key waits to be used. */
const ON: McpStatus = {
  enabled: true,
  address: "http://127.0.0.1:51234/mcp",
  moved: false,
  apps: [
    {
      id: "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e",
      name: "Claude Desktop",
      claimed: true,
      connected: true,
    },
    {
      id: "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5",
      name: "Cursor",
      claimed: false,
      connected: false,
    },
  ],
};

/** Main's side of AI apps, as it is in `status`. */
const mcpWith = (status: McpStatus): McpApi => ({
  status: async () => status,
  setEnabled: async (enabled) => ({ ...status, enabled }),
  add: async () => ({ status: "name-taken" }),
  seenMoved: async () => undefined,
  install: async () => ({ status: "opened" }),
  remove: async () => status,
});

const meta = {
  title: "Dialogs/AI apps",
  component: AiAppsDialog,
  tags: ["full-window"],
  args: {
    open: true,
    mcp: mcpWith(ON),
    copyText: async () => null,
    copySecret: async () => null,
    notify: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof AiAppsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two paired apps: one connected now, one whose key waits to be used. */
export const Paired: Story = {};

/** Off, as it is at first: nothing can connect, and nothing can be added. */
export const Off: Story = {
  args: { mcp: mcpWith({ enabled: false, address: null, moved: false, apps: [] }) },
};

/** The remembered address was taken: the apps have to be added again. */
export const Moved: Story = { args: { mcp: mcpWith({ ...ON, moved: true }) } };

/** Main's side of AI apps, pairing every app it's asked to, with a made-up key. */
const pairing = (): McpApi => ({
  ...mcpWith(ON),
  add: async (name) => ({
    status: "paired",
    app: { id: "2d3e4f5a-6b7c-4d8e-9fa0-b1c2d3e4f5a6", name, claimed: false, connected: false },
    key: "S3cr3tKeyForTheStoryOnly_aaaaaaaaaaaaaaaaaaaaaaaaaa",
    address: ON.address ?? "",
  }),
});

/** Adds the app chosen in *Which app?* by `choice`, under the name offered for it. */
const addAs = (choice: string) => async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Add AI app" }));
  await userEvent.click(screen.getByRole("radio", { name: choice }));
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: "Done" });
};

/** *Add AI app*: the four kinds of app, Claude Desktop first (5.13). */
export const Adding: Story = {
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Add AI app" }));
  },
};

/** Claude Code added: its key, and the command to run, which leaves the key out (5.13). */
export const ClaudeCodeAdded: Story = {
  args: { mcp: pairing() },
  play: addAs("Claude Code"),
};

/** VS Code added: its key, and *Install in VS Code*, whose link leaves the key out (5.13). */
export const VsCodeAdded: Story = {
  args: { mcp: pairing() },
  play: addAs("VS Code (GitHub Copilot)"),
};
