import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_THEME, themeIdSchema } from "@webforge/model";
import { themePreset } from "@webforge/themes";
import { userEvent, within } from "storybook/test";
import type { OwnTheme } from "../../../shared/ipc/themes.js";
import { starterSite } from "../../../shared/starter-site.js";
import type { ItemPreviews } from "../../editor/areas.js";
import { dialogStory } from "../../testing/stories.js";
import { createOwnThemes } from "../own-themes.js";
import { createStudio, type StudioSection } from "./studio-state.js";
import { ThemeStudio } from "./ThemeStudio.js";

// Theme Studio (2.3b, F-DS-7), open on each of its sections, on a new site's theme, in a window of
// 1280 × 800 px and some in one of 1920 × 1080 (CT-11).
const meta = { title: "Dialogs/Theme Studio", tags: ["full-window"] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Stand-ins for the preview strip's drawings, which use the canvas's CSS compiler that Storybook
 * doesn't have: a box as wide as its place, saying what it would draw and the look it would draw.
 */
const itemPreviews: ItemPreviews = (node, device, theme) => (
  <div
    className="flex w-full items-center justify-center rounded-sm border border-dashed border-border p-2 text-center text-xs text-muted-foreground"
    style={{ height: device === "desktop" ? 120 : 200 }}
  >
    {`${node.type}: ${JSON.stringify(theme?.looks?.[node.type] ?? {})}`}
  </div>
);

/** Theme Studio open on `section`, with a preview strip but on Themes. */
const openOn = (section: StudioSection): Story =>
  dialogStory((session) => {
    const studio = createStudio();
    studio.setState({ open: true, section });
    return <ThemeStudio session={session} studio={studio} itemPreviews={itemPreviews} />;
  });

/** The themes as cards, live in their own colours, fonts and corners; the site's marked. */
export const Themes: Story = openOn("themes");

/**
 * Every colour, the page's and reversed sections' side by side, with shades and warnings, under a
 * sample page in the theme.
 */
export const Colours: Story = openOn("colors");

/** Colours at 1920 × 1080 px: the dialog fills the window (CT-11). */
export const ColoursWide: Story = { ...openOn("colors"), tags: ["wide-window"] };

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
      return <ThemeStudio session={session} studio={studio} itemPreviews={itemPreviews} />;
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

/**
 * The Button's look set, beside the theme's button tokens, its fields in columns under the preview;
 * the kinds by category in the bar at the top.
 */
export const Components: Story = componentsOn("Button");

/** Components at 1920 × 1080 px: the look's groups in more columns (CT-11). */
export const ComponentsWide: Story = { ...componentsOn("Button"), tags: ["wide-window"] };

/** The theme's card style, as the Card look. */
export const ComponentsCard: Story = componentsOn("Card");

/**
 * Components on Button, changed but not applied yet (4.10): the preview shows the changes, and the
 * bar at the bottom Apply Changes or Discard.
 */
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
  return <ThemeStudio session={session} studio={studio} itemPreviews={itemPreviews} />;
});

/** Another kind chosen with Button's changes not applied: apply or discard them first (4.10). */
export const ComponentsDraftQuestion: Story = {
  ...ComponentsDraft,
  play: async () => {
    // The dialog draws outside the story's root.
    const page = within(document.body);
    await userEvent.selectOptions(
      await page.findByRole("combobox", { name: "Sections and elements" }),
      "Card",
    );
    await page.findByRole("alertdialog", { name: "Apply your changes to every Button?" });
  },
};

/** The preview showing the theme as it is now, before the changes (4.10). */
export const ComponentsThemeNow: Story = {
  ...ComponentsDraft,
  play: async () => {
    const page = within(document.body);
    await userEvent.click(await page.findByRole("radio", { name: "Theme now" }));
  },
};
