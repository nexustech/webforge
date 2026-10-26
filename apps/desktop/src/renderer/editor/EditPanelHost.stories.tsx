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
import { EditPanelHost } from "./EditPanelHost.js";

// The Edit panel's Style tab on a Hero (2.22, ST-1): the Appearance group every section and
// element has, first, before the Hero's own options.
const meta = { title: "Edit/Appearance group" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The starter site with a Hero whose props add `appearance` to its defaults. */
function siteWithHero(appearance: Readonly<Record<string, unknown>>): SiteDoc {
  const site = starterSite();
  site.pages[site.homePageId]?.doc.content.push({
    type: "Hero",
    props: {
      id: "hero",
      ...structuredClone(siteLibrary.components.Hero?.defaults ?? {}),
      ...appearance,
    },
  });
  return site;
}

/** The Edit panel on the Hero, as the app draws it, its Style tab open. */
function Panel({ session }: { readonly session: Parameters<typeof fieldRenderers>[0]["session"] }) {
  const [renderers] = useState(() => {
    session.select("hero");
    return fieldRenderers({
      session,
      preferences: createPreferencesStore(),
      // No image picker asked for from the canvas in a story.
      imagePicks: { request: () => undefined, take: () => false, subscribe: () => () => undefined },
    });
  });
  return (
    <FieldRenderersProvider renderers={renderers}>
      <div className="h-[720px] w-80 bg-panel text-foreground">
        <EditPanelHost session={session} flush={() => undefined} />
      </div>
    </FieldRenderersProvider>
  );
}

/** Opens the Style tab. */
const styleTab: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("tab", { name: "Style" }));
};

/** Every control at the theme's look: nothing changed. */
export const ThemesLook: Story = {
  ...dialogStory((session) => <Panel session={session} />, { site: siteWithHero({}) }),
  play: styleTab,
};

/**
 * The title underlined and in capitals, a large shadow on the section, a smaller text size on
 * phones: each changed control marked, the per-device one with its dots.
 */
export const Changed: Story = {
  ...dialogStory((session) => <Panel session={session} />, {
    site: siteWithHero({
      lookUnderline: true,
      lookCase: "uppercase",
      lookShadow: "large",
      lookSize: { $responsive: { desktop: "h1", mobile: "h3" } },
    }),
  }),
  play: styleTab,
};
