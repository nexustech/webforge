import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CollectionId, PageEntry, PageId, SiteDoc } from "@webforge/model";
import { userEvent, within } from "storybook/test";
import { starterSite } from "../../shared/starter-site.js";
import { PagesPanel, type PagesPanelActions } from "./PagesPanel.js";

const page = (id: string, title: string, extra: Partial<PageEntry> = {}): PageEntry => ({
  id: id as PageId,
  kind: "page",
  slug: id,
  title,
  settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
  doc: { root: { props: {} }, content: [] },
  ...extra,
});

/**
 * A small business site: pages at the top level and in a folder, one hidden from navigation, and a
 * seasonal menu kept as a draft (G37).
 */
function site(): SiteDoc {
  const base = starterSite();
  const pages = [
    page("home", "Home"),
    page("about", "About us"),
    page("cakes", "Cakes", { folder: "menu" }),
    page("bread", "Bread", { folder: "menu" }),
    page("winter", "Winter specials", {
      folder: "menu",
      settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false, draft: true },
    }),
    page("contact", "Contact"),
    page("thanks", "Thank you", {
      settings: { hideHeader: false, hideFooter: false, hideFromNavigation: true },
    }),
    page("not-found", "Page not found", { kind: "not-found" }),
  ];
  return {
    ...base,
    pages: Object.fromEntries(pages.map((entry) => [entry.id, entry])),
    pageOrder: pages.map((entry) => entry.id),
    homePageId: "home" as PageId,
  };
}

const noop = () => undefined;
const actions: PagesPanelActions = {
  show: noop,
  add: noop,
  addSuggested: noop,
  addPolicy: noop,
  addBlog: noop,
  addPost: noop,
  rename: noop,
  duplicate: noop,
  move: noop,
  moveToFolder: noop,
  setHome: noop,
  setHidden: noop,
  setDraft: noop,
  remove: noop,
  changeSettings: noop,
};

const meta = {
  title: "Panels/Pages",
  component: PagesPanel,
  args: { site: site(), shownPageId: "about" as PageId, actions },
  // In a panel-sized frame, as in the right column.
  render: (args) => (
    <div className="h-72 w-72 border border-border-strong bg-panel">
      <PagesPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof PagesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The pages in navigation order: Home, a folder, a hidden page and "Page not found". */
export const Default: Story = {};

/** A page's menu. */
export const PageMenu: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Actions for Cakes" }));
  },
};

/** Adding a page: its name, and the file it will be. */
export const AddPage: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add Page" }));
    // The menu opens outside the story's root, as menus do.
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("menuitem", {
        name: "Blank Page…",
      }),
    );
  },
};

/**
 * Add Page's menu: a blank page; the privacy page, the terms and, with Google Analytics on, the
 * cookie policy (#855, #866); or a page suggested for a business type (QS-3, 3.11a).
 */
export const AddPageMenu: Story = {
  args: {
    site: (() => {
      const withAnalytics = site();
      withAnalytics.settings.analytics.measurementId = "G-ABC123DEF4";
      return withAnalytics;
    })(),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add Page" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Suggested Pages" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Food and drink" }));
    await body.findByRole("menuitem", { name: "Private hire" });
  },
};

/** Page Settings (F-SET-2): title, file name, description, share image and what the page shows. */
export const PageSettings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Actions for About us" }));
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Page Settings…" }));
  },
};

/** The site with a Blog (6.10a): its posts in a group of their own, newest first, with New Post. */
export const WithBlog: Story = {
  args: {
    site: (() => {
      const withBlog = site();
      const blogId = "blog" as CollectionId;
      withBlog.collections[blogId] = {
        id: blogId,
        preset: "blog",
        name: "Blog",
        folder: "blog",
        fields: [{ name: "date", label: "Date", kind: "date" }],
        design: { before: [], after: [] },
      };
      const posts = [
        page("spring", "Spring opening", {
          folder: "blog",
          collection: blogId,
          entry: { date: "2026-03-01" },
        }),
        page("new-ovens", "Our new ovens", {
          folder: "blog",
          collection: blogId,
          entry: { date: "2026-11-10" },
        }),
      ];
      for (const post of posts) withBlog.pages[post.id] = post;
      withBlog.pageOrder.splice(-1, 0, ...posts.map((post) => post.id));
      return withBlog;
    })(),
    shownPageId: "new-ovens" as PageId,
  },
};
