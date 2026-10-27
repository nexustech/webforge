import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { starterSite } from "../../shared/starter-site.js";
import { fieldRenderers } from "../fields/index.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { dialogStory } from "../testing/stories.js";
import { EditPanelHost } from "./EditPanelHost.js";

// The Edit panel's Style tab on a Heading (2.22, ST-1): the Appearance group every section and
// element has, first, then the Heading's own options and colour.
const meta = { title: "Edit/Appearance group" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The starter site, its Heading's props with `appearance` added. */
function siteWithHeading(appearance: Readonly<Record<string, unknown>>): SiteDoc {
  const site = starterSite();
  const section = site.pages[site.homePageId]?.doc.content[0];
  const heading = (section?.props.content as NodeDoc[] | undefined)?.[0];
  if (heading !== undefined) Object.assign(heading.props, appearance);
  return site;
}

/** The Edit panel on the Heading, as the app draws it. */
function Panel({ session }: { readonly session: Parameters<typeof fieldRenderers>[0]["session"] }) {
  const [renderers] = useState(() => {
    session.select("heading-1");
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
  ...dialogStory((session) => <Panel session={session} />, { site: siteWithHeading({}) }),
  play: styleTab,
};

/**
 * Underlined, in capitals, with a large shadow and a smaller text size on phones: each changed
 * control marked, the per-device one with its dots.
 */
export const Changed: Story = {
  ...dialogStory((session) => <Panel session={session} />, {
    site: siteWithHeading({
      lookUnderline: true,
      lookCase: "uppercase",
      lookShadow: "large",
      lookSize: { $responsive: { desktop: "h1", mobile: "h3" } },
    }),
  }),
  play: styleTab,
};
