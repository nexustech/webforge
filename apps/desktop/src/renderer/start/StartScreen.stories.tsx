import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import type { RecentSite } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { StartScreen, type StartScreenProps } from "./StartScreen.js";

// The window with no site open (F-SITE-1, F-SITE-2, LF-10): start one, open one, try an example,
// or pick a recent one (2.20, B6). The preload API's calls are stand-ins, so nothing opens.

/** A recent site, edited and opened at fixed times so screenshots stay the same. */
const recent = (id: string, name: string, extra: Partial<RecentSite> = {}): RecentSite => ({
  id: id.repeat(32).slice(0, 32),
  name,
  fileName: `${name}.wforge`,
  folder: "Documents",
  lastOpened: "2026-10-20T09:30:00.000Z",
  lastEdited: "2026-10-20T09:15:00.000Z",
  thumbnail: null,
  missing: false,
  pinned: false,
  open: false,
  ...extra,
});

const project = (sites: readonly RecentSite[]): NonNullable<StartScreenProps["project"]> => ({
  create: async () => ({ status: "canceled" }),
  open: async () => ({ status: "canceled" }),
  openZip: async () => ({ status: "canceled" }),
  listRecent: async () => [...sites],
  openRecent: async () => ({ status: "canceled" }),
  pinRecent: async () => null,
  removeRecent: async () => null,
  clearRecent: async () => null,
});

/** The development example, so Try an example shows. */
const example: TemplateSummary = {
  id: "cafe",
  category: "food",
  example: true,
  pages: 2,
  pageList: [],
  theme: "light",
  thumbnail: null,
};

const many = [
  recent("a", "Rosa's Bakery", { pinned: true }),
  recent("b", "Hightown Plumbing", { lastEdited: null }),
  recent("c", "Old portfolio", { missing: true }),
  recent("d", "Corner Café", { folder: "Sites" }),
  recent("e", "Bloom Florist"),
  recent("f", "Clarity Accounts", { folder: "Work" }),
];

const meta = {
  title: "Start/StartScreen",
  component: StartScreen,
  // The whole window, as the app shows it: screenshotted at 1280×800 (e2e/visual).
  tags: ["full-window"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    info: { name: "Webforge", version: "1.0.0" },
    app: { onFlushRequest: () => () => undefined },
    templates: { list: async () => [example] },
    restart: () => undefined,
    locale: "en-GB",
    project: project([]),
  },
} satisfies Meta<typeof StartScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The first start: nothing opened yet. */
export const FirstStart: Story = {};

/** Many recent sites, one pinned to the top and one no longer where it was. */
export const RecentSites: Story = { args: { project: project(many) } };

/** Two pinned sites before the rest. */
export const Pinned: Story = {
  args: {
    project: project([
      recent("a", "Rosa's Bakery", { pinned: true }),
      recent("d", "Corner Café", { pinned: true, folder: "Sites" }),
      recent("b", "Hightown Plumbing"),
    ]),
  },
};

/** Searching the recent sites: only those whose name, file or folder match. */
export const Searching: Story = {
  args: { project: project(many) },
  play: async ({ canvasElement }) => {
    const search = await waitFor(() =>
      canvasElement.querySelector<HTMLInputElement>('input[type="search"]'),
    );
    // React reads a typed value from the input event, through the element's own value setter.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(search, "café");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  },
};

/** The Help tab: the shortcuts sheet and Try an example. */
export const Help: Story = {
  play: async ({ canvasElement }) => {
    const tab = await waitFor(() =>
      [...canvasElement.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (each) => each.textContent === t("site.start.help"),
      ),
    );
    // Radix's tabs change on a primary mouse button's press.
    tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await waitFor(() =>
      canvasElement.querySelector('[role="tabpanel"][data-state="active"] li') === null
        ? undefined
        : true,
    );
  },
};

/** `find`'s element, once the story has drawn it (the list arrives from a promise). */
async function waitFor<T>(find: () => T | null | undefined): Promise<T> {
  for (let tries = 0; tries < 50; tries++) {
    const found = find();
    if (found !== null && found !== undefined) return found;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("The story never drew what it waits for");
}
