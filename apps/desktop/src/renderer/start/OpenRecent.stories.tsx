import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { screen, waitFor } from "storybook/test";
import type { RecentSite } from "../../shared/ipc-contract.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { OpenRecent } from "./OpenRecent.js";

// File › Open Recent › Clear Recent…'s question (3.18): what it clears, and what stays.

/** A recent site named `name`, opened on 27 Nov 2026 at `hour` o'clock. */
const recent = (id: string, name: string, hour: number, pinned: boolean): RecentSite => ({
  id: id.repeat(32),
  name,
  fileName: `${name}.wforge`,
  folder: String.raw`D:\Sites`,
  lastOpened: `2026-11-27T${String(hour).padStart(2, "0")}:00:00.000Z`,
  lastEdited: null,
  thumbnail: null,
  missing: false,
  pinned,
  open: false,
});

const SITES: RecentSite[] = [
  recent("a", "Bloom Bakery", 9, true),
  recent("b", "Rosa's Florist", 8, false),
];

/** File › Open Recent, its sites listed from `SITES`, nothing opened or cleared. */
function Recent() {
  const [registry] = useState(createCommandRegistry);
  return (
    <CommandRegistryProvider registry={registry}>
      <OpenRecent
        project={{
          listRecent: async () => [...SITES],
          openRecent: async () => ({ status: "canceled" }),
          clearRecent: async () => null,
        }}
        restart={() => undefined}
      />
      <button
        type="button"
        hidden
        data-testid="clear-recent"
        onClick={() => registry.run(COMMAND_IDS.clearRecent)}
      />
    </CommandRegistryProvider>
  );
}

const meta = {
  title: "Dialogs/Clear Recent",
  component: Recent,
  tags: ["full-window"],
} satisfies Meta<typeof Recent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Clear Recent…'s question. The list can't be brought back, so its button is red (#1445); pinned
 * sites stay.
 */
export const Asking: Story = {
  play: async () => {
    const run = await screen.findByTestId("clear-recent");
    // The command is registered once the sites are listed.
    await waitFor(async () => {
      run.click();
      await screen.findByRole("alertdialog", undefined, { timeout: 200 });
    });
  },
};
