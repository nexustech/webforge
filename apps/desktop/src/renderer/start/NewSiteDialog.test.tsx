// @vitest-environment happy-dom
import { isMessageKey, t } from "@webforge/i18n";
import { THEME_PRESETS } from "@webforge/themes";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { arrangeTemplates, NewSiteDialog } from "./NewSiteDialog.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const bakery: TemplateSummary = {
  id: "cafe",
  category: "food",
  example: true,
  pages: 2,
  theme: "bistro",
  thumbnail: null,
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

async function render(templates: readonly TemplateSummary[] = [bakery]) {
  const onCreate = vi.fn((_request: NewSiteRequest) => undefined);
  const onCancel = vi.fn();
  await act(async () =>
    root.render(
      <NewSiteDialog open templates={templates} onCreate={onCreate} onCancel={onCancel} />,
    ),
  );
  return { onCreate, onCancel };
}

/** The dialog's controls are in a portal on the body. */
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (each) => each.textContent === name || each.getAttribute("aria-label") === name,
  );
const radio = (label: string) =>
  [...document.querySelectorAll<HTMLLabelElement>("label")]
    .find((each) => each.textContent?.includes(label))
    ?.querySelector<HTMLInputElement>('input[type="radio"]');
const nameField = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="text"]')].find(
    (each) => each.labels?.[0]?.textContent === t("newSite.name"),
  );

async function typeName(value: string) {
  const field = nameField();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(field, value);
    field?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const create = () => act(async () => button(t("newSite.create"))?.click());

describe("NewSiteDialog (2.14a, LF-11)", () => {
  it("makes a blank site in the light theme, named as typed", async () => {
    const { onCreate } = await render();
    expect(nameField()?.value).toBe(t("site.untitledName"));
    expect(radio(t("newSite.blank"))?.checked).toBe(true);
    expect(radio(t("theme.preset.light"))?.checked).toBe(true);

    await typeName("  Rosa's Bakery ");
    await create();

    expect(onCreate).toHaveBeenCalledWith({ name: "Rosa's Bakery", theme: "light" });
  });

  it("makes nothing without a name", async () => {
    const { onCreate } = await render();
    await typeName("   ");

    expect(button(t("newSite.create"))?.disabled).toBe(true);
    await act(async () => {
      document.querySelector("form")?.requestSubmit();
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("starts from a template in its theme, which can then be changed", async () => {
    const { onCreate } = await render();

    await act(async () => radio(t("template.cafe.name"))?.click());
    expect(radio(t("theme.preset.bistro"))?.checked).toBe(true);
    await create();
    expect(onCreate).toHaveBeenLastCalledWith({
      name: t("site.untitledName"),
      theme: "bistro",
      template: "cafe",
    });

    await act(async () => radio(t("theme.preset.dark"))?.click());
    await create();
    expect(onCreate).toHaveBeenLastCalledWith({
      name: t("site.untitledName"),
      theme: "dark",
      template: "cafe",
    });

    // Back to Blank: no template, and the theme stays as chosen.
    await act(async () => radio(t("newSite.blank"))?.click());
    await create();
    expect(onCreate).toHaveBeenLastCalledWith({ name: t("site.untitledName"), theme: "dark" });
  });

  it("shows a template's thumbnail, on its card and in its details (2.14b)", async () => {
    const thumbnail = "data:image/png;base64,iVBORw0KGgo=";
    await render([{ ...bakery, thumbnail }]);

    const card = radio(t("template.cafe.name"))?.closest("label");
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(thumbnail);
    await act(async () =>
      button(t("newSite.detailsOf", { name: t("template.cafe.name") }))?.click(),
    );
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe(thumbnail);
  });

  it("shows a template's details, and Use this template chooses it", async () => {
    const { onCreate } = await render();
    const details = t("newSite.detailsOf", { name: t("template.cafe.name") });

    await act(async () => button(details)?.click());
    expect(document.body.textContent).toContain(t("template.cafe.description"));
    // Opening the details chooses nothing.
    expect(radio(t("newSite.blank"))?.checked).toBe(true);

    await act(async () => button(t("newSite.useTemplate"))?.click());
    expect(document.body.textContent).not.toContain(t("template.cafe.description"));
    await create();
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ template: "cafe" }));
  });

  it("offers chips for the business types the templates have, and says when there are none", async () => {
    await render();
    const chips = [...document.querySelectorAll('[data-slot="toggle-group-item"]')].map(
      (each) => each.textContent,
    );
    expect(chips).toEqual([t("newSite.category.all"), t("template.category.food")]);

    await act(async () => root.unmount());
    root = createRoot(container);
    await render([]);
    expect(document.body.textContent).toContain(t("newSite.noTemplates"));
  });

  it("cancels", async () => {
    const { onCancel, onCreate } = await render();
    await act(async () => button(t("newSite.cancel"))?.click());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("names every theme preset", () => {
    for (const { preset } of THEME_PRESETS) {
      expect(isMessageKey(`theme.preset.${preset}`), preset).toBe(true);
    }
  });
});

describe("arrangeTemplates (UX-29)", () => {
  const templates = [
    { name: "Plumber", category: "trades" },
    { name: "Café", category: "food" },
    { name: "Bakery", category: "food" },
    { name: "Barber", category: "beauty" },
  ];
  const names = {
    name: (each: (typeof templates)[number]) => each.name,
    category: (each: (typeof templates)[number]) => each.category,
  };
  const arranged = (category: string | null, sort: "name" | "category") =>
    arrangeTemplates(templates, category, sort, names).map((each) => each.name);

  it("sorts by name, or by business type and then name", () => {
    expect(arranged(null, "name")).toEqual(["Bakery", "Barber", "Café", "Plumber"]);
    expect(arranged(null, "category")).toEqual(["Barber", "Bakery", "Café", "Plumber"]);
  });

  it("shows only the chosen business type", () => {
    expect(arranged("food", "name")).toEqual(["Bakery", "Café"]);
    expect(arranged("shop", "name")).toEqual([]);
  });
});
