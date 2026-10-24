import { DEFAULT_THEME } from "@webforge/model";
import { loadNodeResources } from "@webforge/pipeline/node";
import { describe, expect, it, vi } from "vitest";
import { createClassCatalogues } from "./class-catalogue.js";

describe("createClassCatalogues (#276)", () => {
  it("lists the site's classes, gives their CSS, and loads each theme once", async () => {
    const load = vi.fn(loadNodeResources);
    const answer = createClassCatalogues(load);
    const theme = { ...DEFAULT_THEME, preset: "light" };

    const listed = await answer({ type: "class-catalogue", id: 1, theme });
    expect(listed).toMatchObject({ type: "class-catalogue", id: 1 });
    if (listed.type !== "class-catalogue") return;
    expect(listed.classes).toContain("bg-primary");
    expect(listed.variants).toContain("md");

    const css = await answer({ type: "class-css", id: 2, theme, classes: ["btn", "pading-4"] });
    expect(css).toMatchObject({ type: "class-css", id: 2 });
    if (css.type !== "class-css") return;
    expect(css.css[0]).toContain(".btn");
    expect(css.css[1]).toBeNull();
    expect(load).toHaveBeenCalledOnce();
  }, 60_000);

  it("answers classes-failed, with no details, when the styles can't load", async () => {
    const answer = createClassCatalogues(() => {
      throw new Error("C:Users\rosa\no-tailwind");
    });

    await expect(answer({ type: "class-catalogue", id: 3, theme: DEFAULT_THEME })).resolves.toEqual(
      { type: "classes-failed", id: 3 },
    );
  });
});
