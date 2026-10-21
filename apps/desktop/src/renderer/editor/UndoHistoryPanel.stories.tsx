import type { Meta, StoryObj } from "@storybook/react-vite";
import type { HistoryEntry, HistoryState } from "@webforge/history";
import { UndoHistoryPanel } from "./UndoHistoryPanel.js";

const entry = (id: string, label: string): HistoryEntry<null> => ({
  id,
  label,
  forward: [],
  inverse: [],
  coalesceKey: null,
  selectionBefore: null,
  selectionAfter: null,
  createdAt: 0,
  updatedAt: 0,
});

const ENTRIES = [
  entry("1", "Added Hero"),
  entry("2", "Edited Heading text"),
  entry("3", "Changed Section padding"),
  entry("4", "Deleted Text"),
  entry("5", "Moved Heading"),
];

const state = (cursor: number, entries = ENTRIES): HistoryState<null> => ({
  entries,
  cursor,
  canUndo: cursor > 0,
  canRedo: cursor < entries.length,
  transaction: null,
});

const meta = {
  title: "Panels/UndoHistory",
  component: UndoHistoryPanel,
  args: { history: { jumpTo: () => true }, state: state(ENTRIES.length) },
  // In a panel-sized frame, as in the left column.
  render: (args) => (
    <div className="h-64 w-72 border border-border-strong bg-panel">
      <UndoHistoryPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof UndoHistoryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Only the opened page: nothing to undo yet. */
export const Empty: Story = { args: { state: state(0, []) } };

/** Every step applied; the newest is current. */
export const AllApplied: Story = {};

/** After undoing two steps: they stay listed, greyed, until a new edit discards them. */
export const WithRedoableSteps: Story = { args: { state: state(3) } };
