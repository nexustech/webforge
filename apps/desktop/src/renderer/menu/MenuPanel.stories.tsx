import type { Meta, StoryObj } from "@storybook/react-vite";
import type { MenuItemId, PageId, SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { userEvent, within } from "storybook/test";
import { starterSite } from "../../shared/starter-site.js";
import { linkTargets } from "../links/index.js";
import { MenuPanel, type MenuPanelActions } from "./MenuPanel.js";

const noop = () => undefined;
const actions: MenuPanelActions = {
  add: noop,
  rename: noop,
  editLink: noop,
  setHidden: noop,
  move: noop,
  remove: noop,
  followPages: noop,
};

const id = (value: string) => value as MenuItemId;

/** The starter site with an About page and an edited menu: a dropdown, a hidden link, a button. */
function editedSite(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const about = "page-about" as PageId;
  site.pages[about] = { ...home, id: about, slug: "about", title: "About us" };
  site.pageOrder.splice(1, 0, about);
  site.menu = {
    follows: "custom",
    items: [
      { id: id("home"), kind: "page", pageId: site.homePageId, hidden: false },
      {
        id: id("more"),
        kind: "group",
        label: "More",
        hidden: false,
        children: [
          { id: id("about"), kind: "page", pageId: about, label: "Our story", hidden: false },
          {
            id: id("blog"),
            kind: "link",
            label: "Blog",
            link: { kind: "url", href: "https://blog.example" },
            hidden: true,
          },
        ],
      },
      {
        id: id("book"),
        kind: "button",
        label: "Book now",
        link: { kind: "url", href: "https://book.example" },
        hidden: false,
      },
    ],
  };
  return site;
}

const meta = {
  title: "Panels/Menu",
  component: MenuPanel,
  args: {
    site: editedSite(),
    linkContext: () => {
      const site = editedSite();
      return { site, targets: linkTargets(site, siteLibrary) };
    },
    actions,
  },
  // In a panel-sized frame, as under Pages in the Site panel.
  render: (args) => (
    <div className="w-60 border border-border-strong bg-panel">
      <MenuPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof MenuPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An edited menu: a dropdown holding a renamed page and a hidden link, and a button. */
export const Edited: Story = {};

/** A new site's menu, which follows the pages. */
export const FollowsPages: Story = { args: { site: starterSite() } };

/** Adding a button: its label and where it goes. */
export const AddingAButton: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add to Menu" }));
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Button…" }));
  },
};
