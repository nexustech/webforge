import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import { dialogStory } from "../testing/stories.js";
import { OwnThemeDialogs } from "./OwnThemeDialogs.js";
import { createOwnThemes, type OwnThemes } from "./own-themes.js";

// My themes' questions (2.23, PH2-17), each open, on a new site's theme.
const meta = { title: "Dialogs/My themes" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** My themes with nothing kept, asking `ask`. */
const asking = (ask: (themes: OwnThemes) => void): Story =>
  dialogStory((session) => {
    const ownThemes = createOwnThemes(() => ({
      list: () => Promise.resolve([]),
      keep: () => Promise.resolve("kept" as const),
      remove: () => Promise.resolve(null),
    }));
    ask(ownThemes);
    return (
      <OwnThemeDialogs ownThemes={ownThemes} site={session.history.document.getState().theme} />
    );
  });

/**
 * Theme Studio's Rename: the person's own version of a built-in theme, saved without asking under
 * its default name at its first change (LF-15), renamed here.
 */
export const Rename: Story = asking((themes) => {
  void themes.askName({
    title: t("theme.own.renameTitle"),
    initial: t("theme.own.defaultName", { name: "Light" }),
    confirm: t("theme.own.renameButton"),
  });
});

/** Theme Studio's New theme: what it starts from, and its name. */
export const NewTheme: Story = asking((themes) => {
  void themes.askNew();
});

/** Deleting one the site uses: the site keeps its copy. */
export const DeleteInUse: Story = asking((themes) => {
  void themes.confirmDelete("Bakery", true);
});
