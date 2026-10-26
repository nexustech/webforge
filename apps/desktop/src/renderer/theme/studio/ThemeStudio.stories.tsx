import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_THEME, themeIdSchema } from "@webforge/model";
import { themePreset } from "@webforge/themes";
import type { OwnTheme } from "../../../shared/ipc/themes.js";
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

/** My themes (2.22): the person's own first, with Rename and Delete, after New theme. */
export const MyThemes: Story = dialogStory((session) => {
  const studio = createStudio();
  studio.setState({ open: true, section: "themes" });
  const ownThemes = createOwnThemes(() => ({
    list: () =>
      Promise.resolve([
        mine("bistro", "theme0000000000a", "Bakery"),
        mine("clarity", "theme0000000000b", "Corner shop"),
      ]),
    keep: () => Promise.resolve(null),
    remove: () => Promise.resolve(null),
  }));
  return <ThemeStudio session={session} studio={studio} ownThemes={ownThemes} />;
});
