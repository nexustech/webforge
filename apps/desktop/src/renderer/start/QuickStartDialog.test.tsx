// @vitest-environment happy-dom
import { t } from "@webforge/i18n";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { QuickStartDialog, type QuickStartStep } from "./QuickStartDialog.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
const trades: TemplateSummary = {
  ...cafe,
  id: "trades",
  category: "trades",
  example: false,
  pages: 2,
  pageList: [
    { id: "trades-home", title: "Home", home: true },
    { id: "trades-quote", title: "Free quote", home: false },
  ],
  theme: "workshop",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(
  options: {
    readonly read?: (url: string) => Promise<ArrayLike<number>>;
    readonly initialStep?: QuickStartStep;
  } = {},
) {
  const onCreate = vi.fn((_request: NewSiteRequest) => undefined);
  const onTryExample = vi.fn((_template: TemplateSummary) => undefined);
  const onChooseTemplate = vi.fn();
  const onCancel = vi.fn();
  await act(async () =>
    root.render(
      <QuickStartDialog
        open
        templates={[cafe, trades]}
        onCreate={onCreate}
        onTryExample={onTryExample}
        onChooseTemplate={onChooseTemplate}
        onCancel={onCancel}
        {...options}
      />,
    ),
  );
  return { onCreate, onTryExample, onChooseTemplate, onCancel };
}

/** The dialog's controls are in a portal on the body. */
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (each) => each.textContent === name,
  );
const click = (name: string) => act(async () => button(name)?.click());
const check = (label: string) =>
  [...document.querySelectorAll<HTMLLabelElement>("label")]
    .find((each) => each.textContent?.startsWith(label))
    ?.querySelector<HTMLInputElement>("input");
const field = (label: string) =>
  [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")].find(
    (each) => each.labels?.[0]?.textContent === label,
  );
/** Goes to a step by its button in the list of steps. */
const goTo = (step: string) =>
  act(async () =>
    [...document.querySelectorAll<HTMLButtonElement>("ol button")]
      .find((each) => each.textContent?.endsWith(step))
      ?.click(),
  );
const shownStep = () => document.querySelector('[aria-current="step"]')?.textContent;

async function type(element: HTMLInputElement | HTMLTextAreaElement | undefined, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("QuickStartDialog (QS-1, 3.11b)", () => {
  it("makes the untitled Blank site from the first step, every step skipped", async () => {
    const { onCreate } = await render();

    expect(shownStep()).toContain(t("quickStart.step.business"));
    await click(t("quickStart.create"));

    expect(onCreate).toHaveBeenCalledWith({
      name: t("site.untitledName"),
      theme: "light",
      business: {},
      pages: { leaveOut: [], recipes: [] },
    });
  });

  it("takes each step's answers: the type's template and theme, the pages, colours and details", async () => {
    const { onCreate } = await render();

    // Your business: the type chooses its first template, in that template's theme.
    await click(t("template.category.food"));
    await type(field(t("quickStart.name")), "Rosa's Bakery");
    await type(field(t("quickStart.whatYouDo")), "Bread and cakes");
    await click(t("quickStart.next"));

    // A look.
    expect(shownStep()).toContain(t("quickStart.step.look"));
    expect(check(t("template.cafe.name"))?.checked).toBe(true);
    expect(check(t("theme.preset.bistro"))?.checked).toBe(true);
    expect(document.body.textContent).toContain(
      t("quickStart.templatesFor", { type: "Food and drink" }),
    );
    await click(t("quickStart.next"));

    // Pages: the home page stays; a page left out, a recipe added.
    const home = check(t("quickStart.homePage", { title: "Home" }));
    expect(home?.checked).toBe(true);
    expect(home?.disabled).toBe(true);
    await act(async () => check("Visit us")?.click());
    expect(check(t("recipe.food-private-hire"))?.checked).toBe(false);
    await act(async () => check(t("recipe.food-private-hire"))?.click());
    await click(t("quickStart.next"));

    // Colours and details.
    expect(shownStep()).toContain(t("quickStart.step.details"));
    await type(
      document.querySelector<HTMLInputElement>('input[type="color"]') ?? undefined,
      "#c0392b",
    );
    await type(field(t("site.settings.phone")), " +44 1234 567890 ");
    await type(field(t("site.settings.webAddress")), "https://rosas.example");
    expect(document.body.textContent).toContain(t("quickStart.searchNote"));
    await click(t("quickStart.create"));

    const request = onCreate.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      name: "Rosa's Bakery",
      theme: "bistro",
      template: "cafe",
      business: {
        description: "Bread and cakes",
        phone: "+44 1234 567890",
        webAddress: "https://rosas.example",
        businessType: "food",
      },
      pages: { leaveOut: ["cafe-visit"], recipes: ["food-private-hire"] },
    });
    expect(request?.themeTokens?.preset).toBe("bistro");
  });

  it("keeps a template of the type chosen, and changes one of another type", async () => {
    await render({ initialStep: "look" });

    // No type yet: every template, and Blank.
    expect(document.body.textContent).toContain(t("template.trades.name"));
    await act(async () => check(t("template.cafe.name"))?.click());
    await goTo(t("quickStart.step.business"));
    await click(t("template.category.food"));
    await goTo(t("quickStart.step.look"));
    expect(check(t("template.cafe.name"))?.checked).toBe(true);

    await goTo(t("quickStart.step.business"));
    await click(t("template.category.trades"));
    await goTo(t("quickStart.step.look"));
    expect(check(t("template.trades.name"))?.checked).toBe(true);
    expect(check(t("theme.preset.workshop"))?.checked).toBe(true);
    expect(document.body.textContent).not.toContain(t("template.cafe.name"));
  });

  it("stops Create on the last step while a detail is in the wrong form, saying why", async () => {
    const { onCreate } = await render({ initialStep: "details" });

    await type(field(t("site.settings.webAddress")), "http://rosas.example");
    await goTo(t("quickStart.step.business"));
    await click(t("quickStart.create"));

    expect(onCreate).not.toHaveBeenCalled();
    expect(shownStep()).toContain(t("quickStart.step.details"));
    expect(document.body.textContent).toContain(t("site.settings.error.webAddress"));
    // Shown where it is: the field with the problem has the focus.
    expect(document.activeElement).toBe(field(t("site.settings.webAddress")));
  });

  it("takes the logo's colours, read here, and says when a picture can't be read", async () => {
    // A red picture, then one that can't be read.
    const red = new Uint8ClampedArray(
      Array.from({ length: 64 }, (_, at) => [200, 30, 30, 255][at % 4] ?? 0),
    );
    const read = vi
      .fn<(url: string) => Promise<ArrayLike<number>>>()
      .mockResolvedValueOnce(red)
      .mockRejectedValueOnce(new Error("not a picture"));
    const { onCreate } = await render({ read, initialStep: "details" });
    const choose = async () => {
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (input === null) throw new Error("No file input");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["logo"], "logo.png", { type: "image/png" })],
      });
      await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    };

    await choose();
    expect(read).toHaveBeenCalledWith(expect.stringMatching(/^blob:/));
    expect(check(t("quickStart.colours.logoChosen"))?.checked).toBe(true);

    await choose();
    expect(document.body.textContent).toContain(t("quickStart.colours.unreadable"));
    // The colours already read stay chosen.
    expect(check(t("quickStart.colours.logoChosen"))?.checked).toBe(true);
    await click(t("quickStart.create"));
    expect(onCreate.mock.calls[0]?.[0].themeTokens).toBeDefined();
  });

  it("offers the type's example, and New Site for choosing a template yourself (QS-4)", async () => {
    const { onTryExample, onChooseTemplate } = await render();

    await click(t("template.category.food"));
    await click(t("quickStart.next"));
    await click(t("quickStart.tryExample"));
    expect(onTryExample).toHaveBeenCalledWith(cafe);

    await click(t("quickStart.chooseTemplate"));
    expect(onChooseTemplate).toHaveBeenCalled();
  });

  it("goes back a step, and offers the type's pages only once a type is chosen", async () => {
    await render({ initialStep: "pages" });

    expect(document.body.textContent).toContain(t("quickStart.noType"));
    expect(document.body.textContent).toContain(t("quickStart.blankPages"));
    await click(t("quickStart.back"));
    expect(shownStep()).toContain(t("quickStart.step.look"));
  });
});
