import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ListVersionsResult } from "../../shared/ipc/versions.js";
import { panelStory } from "../testing/stories.js";
import { registerVersionHistoryPanel } from "./register-version-history-panel.js";
import { createVersionList } from "./version-list.js";

// Version History as the versions area adds it, beside Undo History.
const meta = { title: "Panels/Registered/VersionHistory" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const nothing = async () => false;
const actions = { restore: nothing, remove: nothing, openAsNewSite: async () => undefined };

/** The panel on a site whose versions main lists as `listed`. */
const storyOf = (listed: ListVersionsResult) =>
  panelStory((panels) =>
    registerVersionHistoryPanel(
      panels,
      createVersionList(async () => listed),
      actions,
      () => undefined,
    ),
  );

/** A site with the person's own versions and {appName}'s, newest first. */
export const VersionHistory: Story = storyOf({
  status: "ok",
  bytes: 2_516_582,
  versions: [
    {
      id: "4f0c1a52-8d3e-4b6a-9f21-7c5d8e9a0b11",
      name: "",
      reason: "before-site-wide",
      createdAt: "2026-11-06T15:42:00.000Z",
      bytes: 1024,
    },
    {
      id: "7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
      name: "Before the new menu",
      reason: "manual",
      createdAt: "2026-11-06T10:05:00.000Z",
      bytes: 524_288,
    },
    {
      id: "9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b",
      name: "",
      reason: "daily",
      createdAt: "2026-11-06T08:30:00.000Z",
      bytes: 2048,
    },
    {
      id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
      name: "Spring opening hours, with the long name a person might give a version",
      reason: "manual",
      createdAt: "2026-10-28T17:15:00.000Z",
      bytes: 1_990_000,
    },
  ],
});

/** A new site, with no versions yet. */
export const NoVersions: Story = storyOf({ status: "ok", bytes: 0, versions: [] });
