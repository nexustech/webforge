import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_THEME, type Theme, themeIdSchema } from "@webforge/model";
import { themePreset } from "@webforge/themes";
import { userEvent, within } from "storybook/test";
import type { OwnTheme } from "../../../shared/ipc/themes.js";
import { starterSite } from "../../../shared/starter-site.js";
import type { ItemPreviews, KindPreviews } from "../../editor/areas.js";
import { dialogStory } from "../../testing/stories.js";
import { createOwnThemes } from "../own-themes.js";
import { createStudio, type StudioSection } from "./studio-state.js";
import { ThemeStudio } from "./ThemeStudio.js";

// Theme Studio (2.3b, F-DS-7), open on each of its sections, on a new site's theme.
const meta = { title: "Dialogs/Theme Studio" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Theme Studio open on `section`. */
const openOn = (section: StudioSection): Story =>
  dialogStory((session) => {
    const studio = createStudio();
    studio.setState({ open: true, section });
    return <ThemeStudio session={session} studio={studio} />;
  });

/** The themes as cards, live in their own colours, fonts and corners; the site's marked. */
export const Themes: Story = openOn("themes");

/** Every colour, the page's and reversed sections' side by side, with shades and warnings. */
export const Colours: Story = openOn("colors");

/** The text styles, each shown in itself, and the links' underline. */
export const Text: Story = openOn("text");

/** The other styles by group, the corner and shadow scales as samples. */
export const Styles: Story = openOn("styles");

/** One of the person's own themes, from `preset`, named `name`. */
function mine(preset: string, id: string, name: string): OwnTheme {
  return {
    ...structuredClone(themePreset(preset) ?? DEFAULT_THEME),
    own: { id: themeIdSchema.parse(id), name },
  };
}

/** My themes (2.23): the person's own first, with Rename and Delete, after New theme. */
export const MyThemes: Story = dialogStory((session) => {
  const studio = createStudio();
  studio.setState({ open: true, section: "themes" });
  const ownThemes = createOwnThemes(() => ({
    list: () =>
      Promise.resolve([
        mine("bistro", "theme0000000000a", "Bakery"),
        mine("clarity", "theme0000000000b", "Corner shop"),
      ]),
    keep: () => Promise.resolve("kept" as const),
    remove: () => Promise.resolve(null),
  }));
  return <ThemeStudio session={session} studio={studio} ownThemes={ownThemes} />;
});

/** Components on `kind`, for a site whose theme has a look for Buttons. */
const componentsOn = (kind: string): Story =>
  dialogStory(
    (session) => {
      const studio = createStudio();
      studio.setState({ open: true, section: "components", kind });
      return <ThemeStudio session={session} studio={studio} />;
    },
    {
      site: {
        ...starterSite(),
        theme: {
          ...starterSite().theme,
          looks: { Button: { lookCorners: "full", lookShadow: "large", lookWeight: "bold" } },
        },
      },
    },
  );

/** Each kind with a look, by category; the Button's look set, beside the theme's button tokens. */
export const Components: Story = componentsOn("Button");

/** The theme's card style, as the Card look. */
export const ComponentsCard: Story = componentsOn("Card");

/**
 * Stand-ins for the kind's drawings, which use the canvas's CSS compiler that Storybook doesn't
 * have: a box the drawing's size, saying the look it would draw.
 */
const standIn = (type: string, theme: Theme | undefined, width: number) => (
  <div
    className="flex items-center justify-center rounded-sm border border-dashed border-border p-2 text-center text-xs text-muted-foreground"
    style={{ width, height: 120 }}
  >
    {`${type}: ${JSON.stringify(theme?.looks?.[type] ?? {})}`}
  </div>
);
const kindPreviews: KindPreviews = (type, theme) => standIn(type, theme, 240);
const itemPreviews: ItemPreviews = (node, device, theme) =>
  standIn(node.type, theme, device === "desktop" ? 400 : 150);

/** Components on Button, changed but not applied yet (4.10): Apply Changes or Discard. */
export const ComponentsDraft: Story = dialogStory((session) => {
  const studio = createStudio();
  studio.setState({
    open: true,
    section: "components",
    kind: "Button",
    draft: {
      type: "Button",
      item: "Button",
      change: { lookCorners: "full", lookShadow: "large" },
    },
  });
  return (
    <ThemeStudio
      session={session}
      studio={studio}
      kindPreviews={kindPreviews}
      itemPreviews={itemPreviews}
    />
  );
});

/** Another kind chosen with Button's changes not applied: apply or discard them first (4.10). */
export const ComponentsDraftQuestion: Story = {
  ...ComponentsDraft,
  play: async () => {
    // The dialog draws outside the story's root.
    const page = within(document.body);
    await userEvent.click(await page.findByRole("button", { name: "Card" }));
    await page.findByRole("alertdialog", { name: "Apply your changes to every Button?" });
  },
};

/** The preview opened larger, on Desktop and Mobile, with the changes shown (4.10). */
export const ComponentsLargerPreview: Story = {
  ...ComponentsDraft,
  play: async () => {
    const page = within(document.body);
    await userEvent.click(
      await page.findByRole("button", { name: "Show Button larger, before and after" }),
    );
    await page.findByRole("dialog", { name: "Every Button, before and after" });
  },
};
