import type { Meta, StoryObj } from "@storybook/react-vite";
import { DEFAULT_THEME } from "@webforge/model";
import { fn } from "storybook/test";
import { starterSite } from "../../shared/starter-site.js";
import { themeVariables } from "./css-language.js";
import { StylesheetPanel } from "./StylesheetPanel.js";

const CSS = `/* Opening times stand out. */
.opening-times {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
}

@media (min-width: 48rem) {
  #hours {
    columns: 2;
  }
}
`;

const site = starterSite();

const meta = {
  title: "Panels/Stylesheet",
  component: StylesheetPanel,
  decorators: [
    (Story) => (
      <div className="h-[360px] w-[640px] border border-border">
        <Story />
      </div>
    ),
  ],
  args: {
    css: CSS,
    onChange: fn(),
    siteData: () => ({
      variables: themeVariables(DEFAULT_THEME),
      classes: ["opening-times", "site-hero"],
      ids: ["hours"],
    }),
    lintData: () => ({
      site,
      variables: themeVariables(DEFAULT_THEME),
      used: { classes: new Set(["opening-times"]), ids: new Set(["hours"]) },
      allowListConfirmed: false,
    }),
    hasSelection: true,
    onTarget: fn(),
    onMoveLook: fn(),
  },
} satisfies Meta<typeof StylesheetPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The site's stylesheet, an element selected. */
export const Stylesheet: Story = {};

/** Nothing selected: the two buttons that work on an element are off. */
export const NothingSelected: Story = { args: { css: "", hasSelection: false } };
