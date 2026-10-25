import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import { userEvent, within } from "storybook/test";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { NewSiteDialog } from "./NewSiteDialog.js";

// New Site (2.14a, LF-11): name and theme, then Blank or a template. Creating does nothing here.

const bakery: TemplateSummary = {
  id: "sample",
  category: "food",
  example: true,
  pages: 2,
  theme: "bistro",
};

const meta = {
  title: "Start/NewSiteDialog",
  component: NewSiteDialog,
  args: {
    open: true,
    templates: [bakery],
    onCreate: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof NewSiteDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** As it opens: Blank chosen, in the light theme, with the templates beside it. */
export const Templates: Story = {};

/** No templates yet: only Blank. */
export const NoTemplates: Story = { args: { templates: [] } };

/** A template chosen: the theme switches to the template's. */
export const TemplateChosen: Story = {
  play: async () => {
    // The dialog is in a portal on the body.
    await userEvent.click(
      within(document.body).getByRole("radio", { name: new RegExp(t("template.sample.name")) }),
    );
  },
};

/** A template's Details: its larger preview and description. */
export const DetailsOpen: Story = {
  play: async () => {
    await userEvent.click(
      within(document.body).getByRole("button", {
        name: t("newSite.detailsOf", { name: t("template.sample.name") }),
      }),
    );
  },
};
