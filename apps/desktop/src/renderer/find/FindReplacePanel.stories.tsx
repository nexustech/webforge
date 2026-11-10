import type { Meta, StoryObj } from "@storybook/react-vite";
import { type FindGroup, FindReplacePanel } from "./FindReplacePanel.js";

// Find and Replace's panel (6.2): what was found, by page, and what was typed.

const GROUPS: readonly FindGroup[] = [
  {
    key: "home",
    name: "Home",
    rows: [
      {
        key: "home-title",
        where: "Title",
        before: "",
        found: "Smith",
        after: " & Sons, Plumbers",
      },
      {
        key: "home-hero",
        where: "Hero · Title",
        before: "Friendly plumbing from ",
        found: "Smith",
        after: " & Sons since 1982",
      },
      {
        key: "home-text",
        where: "About us · Text",
        before: "Three generations of the family business: Grandad Harold ",
        found: "Smith",
        after: " started it with one van and a toolbox, and his grandchildren run it today.",
      },
    ],
  },
  {
    key: "footer",
    name: "Footer",
    rows: [
      {
        key: "footer-text",
        where: "Footer · Text",
        before: "© ",
        found: "Smith",
        after: " & Sons",
      },
    ],
  },
  {
    key: "settings",
    name: "Site Settings",
    rows: [
      { key: "name", where: "Business name", before: "", found: "Smith", after: " & Sons Ltd" },
    ],
  },
];

const meta = {
  title: "Panels/Find and Replace",
  component: FindReplacePanel,
  args: {
    state: { query: "Smith", replacement: "Smyth", matchCase: true, wholeWords: true },
    groups: GROUPS,
    onChange: () => undefined,
    onShow: () => undefined,
    onReplace: () => undefined,
    onReplaceAll: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="h-80 w-[56rem] border border-border bg-panel">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FindReplacePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five matches in three places, each with the text around it and its own Replace. */
export const Found: Story = {};

/** Typed, but not anywhere in the site. */
export const NothingFound: Story = {
  args: {
    state: { query: "Smyth", replacement: "", matchCase: false, wholeWords: false },
    groups: [],
  },
};
