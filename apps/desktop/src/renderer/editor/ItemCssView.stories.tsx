import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { starterSite } from "../../shared/starter-site.js";
import { fieldRenderers } from "../fields/index.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { dialogStory } from "../testing/stories.js";
import { EditPanelHost } from "./EditPanelHost.js";
import type { ItemCssServices } from "./ItemCssView.js";

// Advanced mode's CSS tab (3.14, CT-7), at the end of the Edit panel's Advanced tab, on a Heading
// with a colour and a shadow of its own. Storybook has no canvas styles worker: a stand-in writes
// the item and its rules as the export would.
const meta = { title: "Edit/CSS tab" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** What the stand-in compiles each class to, as the site's stylesheet has it. */
const RULES: Readonly<Record<string, string>> = {
  "text-3xl":
    ".text-3xl {\n  font-size: var(--text-3xl);\n  line-height: var(--tw-leading, var(--text-3xl--line-height));\n}",
  "font-bold":
    ".font-bold {\n  --tw-font-weight: var(--font-weight-bold);\n  font-weight: var(--font-weight-bold);\n}",
  "text-primary!": ".text-primary\\! {\n  color: var(--color-primary) !important;\n}",
  "shadow-lg!": ".shadow-lg\\! {\n  box-shadow: var(--shadow-lg) !important;\n}",
};

/** The stand-in worker: the Heading as the export writes it, or `html` instead. */
const services = (
  html = '<h2 class="text-3xl font-bold text-primary! shadow-lg!">Fresh bread every morning</h2>\n',
): ItemCssServices => ({
  api: {
    itemHtml: async () => ({ status: "html", html }),
    classCss: async (_theme, classes) => ({
      status: "css",
      css: classes.map((name) => RULES[name] ?? null),
    }),
  },
  copyText: async () => null,
  onOpenCustomCode: () => undefined,
});

/** The starter site, its Heading's props with `appearance` added. */
function siteWithHeading(appearance: Readonly<Record<string, unknown>>): SiteDoc {
  const site = starterSite();
  const section = site.pages[site.homePageId]?.doc.content[0];
  const heading = (section?.props.content as NodeDoc[] | undefined)?.[0];
  if (heading !== undefined) Object.assign(heading.props, appearance);
  return site;
}

/** The Edit panel on the Heading in Advanced mode, as the app draws it. */
function Panel({
  session,
  css,
}: {
  readonly session: Parameters<typeof fieldRenderers>[0]["session"];
  readonly css: ItemCssServices;
}) {
  const [renderers] = useState(() => {
    session.select("heading-1");
    return fieldRenderers({
      session,
      preferences: createPreferencesStore({
        preferences: { ...DEFAULT_PREFERENCES, editorLevel: "advanced" },
      }),
      imagePicks: { request: () => undefined, take: () => false, subscribe: () => () => undefined },
    });
  });
  return (
    <FieldRenderersProvider renderers={renderers}>
      <div className="h-[900px] w-80 bg-panel text-foreground">
        <EditPanelHost session={session} flush={() => undefined} advanced itemCss={css} />
      </div>
    </FieldRenderersProvider>
  );
}

/** Opens the Advanced tab, and waits for the CSS. */
const advancedTab =
  (shown: string): NonNullable<Story["play"]> =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "Advanced" }));
    await canvas.findByText(shown, {}, { timeout: 5000 });
  };

/** Its markup, its colour and shadow's classes with the tokens behind them, and their rules. */
export const Item: Story = {
  ...dialogStory((session) => <Panel session={session} css={services()} />, {
    site: siteWithHeading({ lookColor: "primary", lookShadow: "large" }),
  }),
  play: advancedTab("Stylesheet rules"),
};

/** Hidden in Layers: the export leaves it out, and the tab says so. */
export const Hidden: Story = {
  ...dialogStory((session) => <Panel session={session} css={services("")} />, {
    site: siteWithHeading({}),
  }),
  play: advancedTab("This item is hidden, so the export leaves it out."),
};
