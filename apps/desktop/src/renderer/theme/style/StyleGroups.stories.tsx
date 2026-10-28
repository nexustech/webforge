import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { starterSite } from "../../../shared/starter-site.js";
import { createPreferencesStore } from "../../shell/preferences-store.js";
import { dialogStory } from "../../testing/stories.js";
import { StyleDialog } from "./StyleDialog.js";
import { openStyle } from "./style-apply.js";
import { createStyleDialog } from "./style-state.js";

// Style this ‹kind›…'s deeper groups (3.13b, CT-2), one story each: the dialog open on an item
// with values in that group, scrolled to it. The previews draw with the canvas's CSS compiler,
// which Storybook doesn't have: their places show.
const meta = { title: "Dialogs/Style This/Groups" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A page with a Hero and a Button, `values` set on the one `item`. */
function site(item: "hero" | "button", values: Readonly<Record<string, unknown>>): SiteDoc {
  const made = starterSite();
  const home = made.pages[made.homePageId];
  const button: NodeDoc = {
    type: "Button",
    props: { id: "button", label: "Book a table", link: "", ...(item === "button" ? values : {}) },
  };
  if (home !== undefined) {
    home.doc.content = [
      {
        type: "Hero",
        props: {
          id: "hero",
          title: "Rosa's Bakery",
          text: "Fresh bread every morning",
          ...(item === "hero" ? values : {}),
        },
      },
      { type: "Section", props: { id: "s", content: [button] } },
    ];
  }
  return made;
}

/** The dialog open on `item` with `values`, scrolled to the group named `group`. */
const groupStory = (
  item: "hero" | "button",
  group: string,
  values: Readonly<Record<string, unknown>>,
): Story => ({
  ...dialogStory(
    (session) => {
      session.select(item);
      const state = createStyleDialog();
      state.setState({ open: true, since: openStyle(session), scope: "this" });
      return <StyleDialog session={session} state={state} preferences={createPreferencesStore()} />;
    },
    { site: site(item, values) },
  ),
  play: async ({ canvasElement }) => {
    const heading = [
      ...canvasElement.ownerDocument.querySelectorAll<HTMLElement>("[role=dialog] button"),
    ].find((each) => each.textContent === group);
    if (heading === undefined) throw new Error(`No group ${group}`);
    heading.scrollIntoView({ block: "start" });
  },
});

/** Background (CT-4): a gradient between two theme colours, across. */
export const Background: Story = groupStory("button", "Background", {
  lookGradientDirection: "toRight",
  lookGradientFrom: "primary",
  lookGradientTo: "accent-300",
});

/** Border, a side of its own with a dashed line, and Corners, one by one. */
export const BorderAndCorners: Story = groupStory("button", "Border", {
  lookBorderBottom: "thick",
  lookBorderStyle: "dashed",
  lookCornerTopLeft: "large",
  lookCornerBottomRight: "none",
});

/** Shadow, inside the edges; and Spacing, the element's padding and margin (CT-5). */
export const ShadowAndSpacing: Story = groupStory("button", "Shadow", {
  lookShadow: "medium",
  lookShadowInner: true,
  lookPadding: "l",
  margin: { top: "m" },
});

/** Title: a section's title colour and its subtitle's look. */
export const Title: Story = groupStory("hero", "Title", {
  lookTitleColor: "primary",
  lookSubtitleSize: "h5",
  lookSubtitleCase: "uppercase",
});

/** When hovered: 2.28's effect, with a colour of its own. */
export const WhenHovered: Story = groupStory("button", "When hovered", {
  hover: "lift",
  lookHoverColor: "secondary",
});
