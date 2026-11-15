import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import type { SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { starterSite } from "../../shared/starter-site.js";
import { fieldRenderers } from "../fields/index.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { dialogStory } from "../testing/stories.js";
import { storyPreloadApi } from "../testing/story-preload.js";
import { EditPanelHost } from "./EditPanelHost.js";

// The Edit panel at the default layout's width (#1007): 300 px, the right column's own. A Hero's
// fields fit without scrolling sideways, its link's buttons included, and each colour's whole name
// shows, one to a row.
const meta = { title: "Edit/At the default width" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The starter site with a Hero, as the Add panel places one, at the top of its home page. */
function siteWithHero(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  const hero = siteLibrary.components.Hero;
  if (home !== undefined && hero !== undefined) {
    home.doc.content.unshift({ type: "Hero", props: { ...hero.defaults, id: "hero" } });
  }
  return site;
}

/** The Edit panel on the Hero, in a column as wide as the default layout's. */
function Panel({ session }: { readonly session: Parameters<typeof fieldRenderers>[0]["session"] }) {
  const [renderers] = useState(() => {
    session.select("hero");
    return fieldRenderers({
      api: storyPreloadApi(),
      session,
      preferences: createPreferencesStore(),
      // No image picker asked for from the canvas in a story.
      imagePicks: { request: () => undefined, take: () => false, subscribe: () => () => undefined },
    });
  });
  return (
    <FieldRenderersProvider renderers={renderers}>
      <div className="h-[900px] w-[300px] bg-panel text-foreground">
        <EditPanelHost session={session} flush={() => undefined} />
      </div>
    </FieldRenderersProvider>
  );
}

/** The Content tab: its title, text and link under their labels, at the panel's width. */
export const Content: Story = dialogStory((session) => <Panel session={session} />, {
  site: siteWithHero(),
});

/** The Style tab: the colours one to a row, each with its whole name. */
export const Style: Story = {
  ...dialogStory((session) => <Panel session={session} />, { site: siteWithHero() }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("tab", { name: "Style" }));
  },
};
