import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { type ItemCssApi, itemCssOf, tokensIn } from "./item-css.js";

/** The canvas styles worker, answering with `html` and a rule for each class but `none`. */
function fakeApi(html: string | null | "failed"): ItemCssApi {
  return {
    itemHtml: vi.fn(async () =>
      html === "failed" ? { status: "failed" as const } : { status: "html" as const, html },
    ),
    classCss: vi.fn(async (_theme, classes: readonly string[]) => ({
      status: "css" as const,
      css: classes.map((name) =>
        name === "none" ? null : `.${name} { color: var(--color-${name}); }`,
      ),
    })),
  };
}

describe("itemCssOf (3.14)", () => {
  const site = starterSite();
  const page = site.homePageId;

  it("gives the item's markup and each class's rule, in the markup's order, once each", async () => {
    const api = fakeApi(
      '<section class="p-4 none">\n  <h2 class="text-primary p-4">Hi</h2>\n</section>\n',
    );

    const css = await itemCssOf(site, page, "hero", api);

    expect(css).toEqual({
      status: "ready",
      html: '<section class="p-4 none">\n  <h2 class="text-primary p-4">Hi</h2>\n</section>\n',
      rules: [
        { className: "p-4", css: ".p-4 { color: var(--color-p-4); }" },
        { className: "text-primary", css: ".text-primary { color: var(--color-text-primary); }" },
      ],
    });
    expect(api.itemHtml).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: page, nodeId: "hero", sizes: expect.any(Object) }),
    );
  });

  it("asks for at most 200 classes at once", async () => {
    const many = Array.from({ length: 450 }, (_, n) => `c${n}`).join(" ");
    const api = fakeApi(`<div class="${many}"></div>`);

    const css = await itemCssOf(site, page, "hero", api);

    expect(vi.mocked(api.classCss).mock.calls.map(([, classes]) => classes.length)).toEqual([
      200, 200, 50,
    ]);
    expect(css.status === "ready" && css.rules).toHaveLength(450);
  });

  it("says when the item is hidden, gone or couldn't be written", async () => {
    expect(await itemCssOf(site, page, "hero", fakeApi(""))).toEqual({ status: "hidden" });
    expect(await itemCssOf(site, page, "hero", fakeApi(null))).toEqual({ status: "failed" });
    expect(await itemCssOf(site, page, "hero", fakeApi("failed"))).toEqual({ status: "failed" });
  });
});

describe("tokensIn (3.14)", () => {
  it("lists the theme tokens a rule uses, once each", () => {
    expect(
      tokensIn(
        ".x { color: var(--color-primary); border-color: var(--color-primary); padding: var(--spacing) }",
      ),
    ).toEqual(["--color-primary", "--spacing"]);
    expect(tokensIn(".x { display: flex }")).toEqual([]);
  });
});
