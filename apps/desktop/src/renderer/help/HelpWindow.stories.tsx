import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { HelpWindow } from "./HelpWindow.js";
import { helpLibraryOf } from "./help-library.js";

// A small library of its own, so the screenshots don't change whenever a help page does.
const front = (id: string, title: string, summary: string, extra = "") =>
  `---\nid: ${id}\ntitle: ${title}\nsummary: ${summary}\nrelated: []\nupdated: 2026-11-07\n${extra}---\n\n`;

const LIBRARY = helpLibraryOf(
  {
    "/help/getting-started.md": `${front("getting-started", "Getting started", "Make your first site, with the quick start, a template or an example.")}# Getting started\n\nWith {appName} you make a website on your own computer.`,
    "/help/site-check.md": `${front("site-check", "Site Check", "What Site Check looks for, and how to fix it.")}# Site Check\n\n**Site Check** looks over your whole site as you work and lists anything to fix before your website goes live. It's in the bottom panel; show or hide it with Ctrl+J (Cmd+J on a Mac).\n\n## Tips\n\n| Check | What it means | What to do |\n|---|---|---|\n| **Large downloads** | A linked document is over 10 MB | Use a smaller copy |\n| **Year on your site** | Your text uses \`{year}\`, and that year has passed | **Fix** opens [Publish](publish.md) |\n\nSee [Forms](forms.md#sending) for forms, or [the guide](https://www.example.org/) on the web.`,
    "/help/publish.md": `${front("publish", "Publish", "Put your website on your web host.", "status: partial\n")}# Publish\n\n**Publish** puts your website on your web host for you.\n\n1. Runs Site Check.\n2. Sends only new and changed files.\n3. Removes files your site no longer has.`,
    "/help/forms.md": `${front("forms", "Forms", "Contact forms, and where their messages go.")}# Forms\n\n## Sending\n\nForms send their messages through a service you choose.`,
  },
  [
    "## Contents",
    "",
    "**Start here**",
    "- [Getting started](getting-started.md)",
    "",
    "**Checking and going live**",
    "- [Site Check](site-check.md)",
    "- [Publish](publish.md)",
    "",
    "**Your site's look and content**",
    "- [Forms](forms.md)",
  ].join("\n"),
);

const meta = {
  title: "Help/Help window",
  component: HelpWindow,
  tags: ["full-window"],
  args: {
    library: LIBRARY,
    start: {},
    openExternal: async () => true,
    onShow: () => () => undefined,
  },
} satisfies Meta<typeof HelpWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opened with F1: the contents, each page with its summary. */
export const Contents: Story = {};

/** A page: its headings, a table, code, links to other pages and to the web. */
export const Page: Story = { args: { start: { page: "site-check" } } };

/** A page of a feature that's only partly there says so first. */
export const PartialPage: Story = { args: { start: { page: "publish" } } };

/** What a search finds, the title's matches first. */
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search help" }), "site");
    await expect(canvas.getByRole("region", { name: "Pages with those words" })).toBeVisible();
  },
};

/** A search no page answers. */
export const NothingFound: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "Search help" }), "volcano");
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};
