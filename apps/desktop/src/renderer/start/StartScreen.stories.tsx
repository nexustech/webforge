import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RecentSite } from "../../shared/ipc/project.js";
import { StartScreen, type StartScreenProps } from "./StartScreen.js";

// The window with no site open (F-SITE-1, F-SITE-2): start one, open one, or pick a recent one
// (2.20, B6). The preload API's calls are stand-ins, so nothing opens.

/** A recent site, edited and opened at fixed times so screenshots stay the same. */
const recent = (id: string, name: string, extra: Partial<RecentSite> = {}): RecentSite => ({
  id: id.repeat(32).slice(0, 32),
  name,
  fileName: `${name}.wforge`,
  lastOpened: "2026-10-20T09:30:00.000Z",
  lastEdited: "2026-10-20T09:15:00.000Z",
  thumbnail: null,
  missing: false,
  ...extra,
});

const project = (sites: readonly RecentSite[]): NonNullable<StartScreenProps["project"]> => ({
  create: async () => ({ status: "canceled" }),
  open: async () => ({ status: "canceled" }),
  listRecent: async () => [...sites],
  openRecent: async () => ({ status: "canceled" }),
  removeRecent: async () => null,
});

const meta = {
  title: "Start/StartScreen",
  component: StartScreen,
  args: {
    info: { name: "Webforge", version: "1.0.0" },
    app: { onFlushRequest: () => () => undefined },
    restart: () => undefined,
    locale: "en-GB",
    project: project([]),
  },
} satisfies Meta<typeof StartScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The first start: nothing opened yet. */
export const FirstStart: Story = {};

/** Recent sites, one of them no longer where it was. */
export const RecentSites: Story = {
  args: {
    project: project([
      recent("a", "Rosa's Bakery"),
      recent("b", "Hightown Plumbing", { lastEdited: null }),
      recent("c", "Old portfolio", { missing: true }),
    ]),
  },
};
