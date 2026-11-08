import type { Meta, StoryObj } from "@storybook/react-vite";
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
  installClaude: async () => ({ status: "opened" }),
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
