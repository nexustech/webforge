import type { Meta, StoryObj } from "@storybook/react-vite";
import { createPublishOutcomes, PublishOutcomeDialogs } from "./PublishOutcomeDialogs.js";
import type { LivePublish } from "./publish-flow.js";

const LIVE: LivePublish = {
  operationId: "1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f",
  url: "https://www.rosasbakery.co.uk/",
  check: "live",
  uploaded: 14,
  unchanged: 32,
  removed: 1,
  versionSaved: true,
};

/** The publish's dialogs with *Your site is live* open for `live`. */
const liveState = (live: LivePublish) => {
  const outcomes = createPublishOutcomes();
  outcomes.showLive(live);
  return outcomes.state;
};

const meta = {
  title: "Dialogs/Publish outcome",
  component: PublishOutcomeDialogs,
  tags: ["full-window"],
  args: {
    state: liveState(LIVE),
    openLive: () => undefined,
    copyLink: () => undefined,
  },
} satisfies Meta<typeof PublishOutcomeDialogs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Your site is live: its address, Open Site and Copy Link. */
export const Live: Story = {};

/**
 * Live, but its address shows another page for now, and its version couldn't be kept: said
 * quietly, never as a failure.
 */
export const LiveWithNotes: Story = {
  args: { state: liveState({ ...LIVE, check: "different", versionSaved: false }) },
};

/** Live on a host without a web address: nothing to open or copy yet. */
export const LiveWithoutAddress: Story = {
  args: { state: liveState({ ...LIVE, url: "", check: "unchecked" }) },
};

/** Another site published to the same folder: replace it only when asked (A8). */
export const ReplaceOtherSite: Story = {
  args: {
    state: (() => {
      const outcomes = createPublishOutcomes();
      void outcomes.askReplace("Rosa's Bakery");
      return outcomes.state;
    })(),
  },
};
