import { DEFAULT_THEME, type ThemeId } from "@webforge/model";
import { describeChannels } from "./contract-kit.test-helper.js";
import { type OwnTheme, themesChannels } from "./themes.js";

/** One of the person's own themes: a built-in one, kept under a name of theirs. */
const OWN: OwnTheme = {
  ...DEFAULT_THEME,
  own: { id: "bakery-colours" as ThemeId, name: "Bakery" },
};

describeChannels("themes", themesChannels, {
  listThemes: { response: [OWN] },
  keepTheme: { request: [OWN] },
});
