import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantSettingsDialog } from "./AssistantSettingsDialog.js";
import { createFakeAssistant, FAKE_STATUS } from "./fake-assistant.js";

// The assistant's settings (6.9c, AIA-6, AIA-8), opened from Settings › Assistant, on 6.9a's
// stand-in for main.
const meta = { title: "Dialogs/Assistant Settings", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Off: Turn On… shows the consent first. */
export const Off: Story = {
  render: () => (
    <AssistantSettingsDialog
      open
      onOpenChange={() => undefined}
      api={createFakeAssistant({
        status: { ...FAKE_STATUS, enabled: false, consentVersion: null },
      })}
    />
  ),
};

/** On, past 80% of this month's limit. */
export const On: Story = {
  render: () => (
    <AssistantSettingsDialog
      open
      onOpenChange={() => undefined}
      api={createFakeAssistant({
        status: {
          ...FAKE_STATUS,
          month: { spentUsd: 4.2, limitUsd: 5, warned: true, reached: false },
        },
      })}
    />
  ),
};
