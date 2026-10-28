import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import { userEvent, within } from "storybook/test";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { QuickStartDialog } from "./QuickStartDialog.js";

// The quick start (QS-1, 3.11b): four steps, each optional. Creating does nothing here.

const cafe: TemplateSummary = {
  id: "cafe",
  category: "food",
  example: true,
  pages: 4,
  pageList: [
    { id: "cafe-home", title: "Home", home: true },
    { id: "cafe-menu", title: "Menu", home: false },
    { id: "cafe-about", title: "About us", home: false },
    { id: "cafe-visit", title: "Visit us", home: false },
  ],
  theme: "bistro",
  thumbnail: null,
};
const salon: TemplateSummary = {
  ...cafe,
  id: "salon",
  category: "beauty",
  example: false,
  pages: 2,
  pageList: [
    { id: "salon-home", title: "Home", home: true },
    { id: "salon-book", title: "Book", home: false },
  ],
  theme: "atelier",
};

const meta = {
  title: "Start/QuickStartDialog",
  component: QuickStartDialog,
  args: {
    open: true,
    templates: [cafe, salon],
    onCreate: () => undefined,
    onTryExample: () => undefined,
    onChooseTemplate: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof QuickStartDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The dialog, in its portal on the page. */
const dialog = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

/** Your business, answered: the type, the name and what it does. */
async function answerBusiness(canvasElement: HTMLElement) {
  const body = dialog(canvasElement);
  await userEvent.click(await body.findByRole("radio", { name: t("template.category.food") }));
  const name = body.getByLabelText(t("quickStart.name"));
  await userEvent.clear(name);
  await userEvent.type(name, "Rosa's Bakery");
  await userEvent.type(body.getByLabelText(t("quickStart.whatYouDo")), "Bread and cakes");
}

/** The step named `step`, from the list of steps. */
async function goTo(canvasElement: HTMLElement, step: string) {
  await userEvent.click(
    dialog(canvasElement).getByRole("button", { name: new RegExp(`${step}$`) }),
  );
}

/** As it opens: *Your business*, nothing answered. */
export const Business: Story = {};

/** *Your business*, answered. */
export const BusinessAnswered: Story = {
  play: ({ canvasElement }) => answerBusiness(canvasElement),
};

/** *A look*: the business type's templates, its first chosen in its theme, and its example. */
export const Look: Story = {
  play: async ({ canvasElement }) => {
    await answerBusiness(canvasElement);
    await goTo(canvasElement, t("quickStart.step.look"));
  },
};

/** *Pages*: the template's pages, one left out, and the type's suggestions, one ticked. */
export const Pages: Story = {
  play: async ({ canvasElement }) => {
    await answerBusiness(canvasElement);
    await goTo(canvasElement, t("quickStart.step.pages"));
    const body = dialog(canvasElement);
    await userEvent.click(body.getByRole("checkbox", { name: "Visit us" }));
    await userEvent.click(body.getByRole("checkbox", { name: t("recipe.food-private-hire") }));
  },
};

/** *Pages* with no business type chosen: Blank's pages, and no suggestions yet. */
export const PagesWithoutType: Story = { args: { initialStep: "pages" } };

/** *Colours and details*: the theme's own colours, three palettes, a colour, the logo; the details. */
export const Details: Story = { args: { initialStep: "details" } };

/** A web address in the wrong form stops Create, and says why. */
export const DetailsProblem: Story = {
  args: { initialStep: "details" },
  play: async ({ canvasElement }) => {
    const body = dialog(canvasElement);
    await userEvent.type(
      await body.findByLabelText(t("site.settings.webAddress")),
      "http://rosas.example",
    );
    await userEvent.click(body.getByRole("button", { name: t("quickStart.create") }));
    await body.findByText(t("site.settings.error.webAddress"));
  },
};
