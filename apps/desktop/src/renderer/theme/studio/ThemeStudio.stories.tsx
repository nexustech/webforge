import type { Meta, StoryObj } from "@storybook/react-vite";
import { dialogStory } from "../../testing/stories.js";
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
