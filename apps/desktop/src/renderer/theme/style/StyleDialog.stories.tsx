import type { Meta, StoryObj } from "@storybook/react-vite";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { starterSite } from "../../../shared/starter-site.js";
import { createPreferencesStore } from "../../shell/preferences-store.js";
import { dialogStory } from "../../testing/stories.js";
import { StyleDialog } from "./StyleDialog.js";
import { openStyle } from "./style-apply.js";
import { createStyleDialog, type StyleDialogState } from "./style-state.js";

// Style this ‹kind›… (3.13a, CT-2), on a Button with a look of its own beside a plain one. The
// previews draw with the canvas's CSS compiler, which Storybook doesn't have: their places show.
const meta = { title: "Dialogs/Style This" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const button = (id: string, look: Readonly<Record<string, unknown>> = {}): NodeDoc => ({
  type: "Button",
  props: { id, label: "Book a table", link: "", ...look },
});

/** A page with the Button `styled`, its shadow and corners its own, and a plain one. */
function site(): SiteDoc {
  const made = starterSite();
  const home = made.pages[made.homePageId];
  if (home !== undefined) {
    home.doc.content = [
      {
        type: "Section",
        props: {
          id: "s",
          content: [
            button("styled", { lookShadow: "large", lookCorners: "full" }),
            button("plain"),
          ],
        },
      },
    ];
  }
  return made;
}

/** The dialog open on the styled Button, choosing `scope`. */
const openWith = (scope: StyleDialogState["scope"]): Story =>
  dialogStory(
    (session) => {
      session.select("styled");
      const state = createStyleDialog();
      state.setState({ open: true, since: openStyle(session), scope });
      return <StyleDialog session={session} state={state} preferences={createPreferencesStore()} />;
    },
    { site: site() },
  );

/** Its Appearance fields with their sources, the previews' places, and *This Button only*. */
export const ThisOne: Story = openWith("this");

/** *Every Button on the site*, with how many others it reaches. */
export const EveryOne: Story = openWith("site");
