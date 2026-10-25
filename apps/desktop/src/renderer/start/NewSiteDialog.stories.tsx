import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
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

/** The dialog's control labelled `name`, in its portal on the page. */
function control(canvasElement: HTMLElement, selector: string, name: string): HTMLElement {
  const found = [...canvasElement.ownerDocument.querySelectorAll<HTMLElement>(selector)].find(
    (element) => (element.getAttribute("aria-label") ?? element.textContent ?? "").includes(name),
  );
  if (found === undefined) throw new Error(`No ${selector} ${name}`);
  return found;
}

/** A template chosen: the theme switches to the template's. */
export const TemplateChosen: Story = {
  play: ({ canvasElement }) => {
    control(canvasElement, "label", t("template.sample.name")).click();
  },
};

/** A template's Details: its larger preview and description. */
export const DetailsOpen: Story = {
  play: ({ canvasElement }) => {
    control(
      canvasElement,
      "button",
      t("newSite.detailsOf", { name: t("template.sample.name") }),
    ).click();
  },
};
