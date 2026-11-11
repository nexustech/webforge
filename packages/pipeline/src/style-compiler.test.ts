import { DEFAULT_THEME } from "@webforge/model";
import * as tailwind from "tailwindcss";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSiteCss, createStyleCompiler } from "./css.js";
import { loadNodeResources } from "./node-resources.js";
import type { PipelineResources } from "./resources.js";

// Counts Tailwind's compiles, to tell a kept compiler from a new one.
vi.mock("tailwindcss", async (original) => {
  const actual = await original<typeof import("tailwindcss")>();
  return { ...actual, compile: vi.fn(actual.compile) };
});
const compile = vi.mocked(tailwind.compile);

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
});

beforeEach(() => {
  compile.mockClear();
});

const options = (candidates: readonly string[]) => ({
  theme: DEFAULT_THEME,
  candidates,
  fontsUrl: "../fonts/",
});
const shownPage = ["btn", "p-4", "md:grid-cols-3"];
const wholeSite = [...shownPage, "skew-x-12", "hover:underline"];

describe("createStyleCompiler, asked again while its compiler is prepared (#945)", () => {
  it("prepares one compiler for more classes asked for meanwhile, each build exact", async () => {
    const styles = createStyleCompiler(resources);

    // The canvas's shown page, then the whole site's, before the first compile has answered.
    const [first, second] = await Promise.all([
      styles.css(options(shownPage)),
      styles.css(options(wholeSite)),
    ]);

    expect(compile).toHaveBeenCalledOnce();
    expect(first).toBe(await buildSiteCss(resources, options(shownPage)));
    expect(second).toBe(await buildSiteCss(resources, options(wholeSite)));
  });

  it("prepares another for fewer classes asked for meanwhile, so an exact build stays exact", async () => {
    const styles = createStyleCompiler(resources);

    const [first, second] = await Promise.all([
      styles.css(options(wholeSite)),
      styles.css(options(shownPage)),
    ]);

    expect(compile).toHaveBeenCalledTimes(2);
    expect(first).toBe(await buildSiteCss(resources, options(wholeSite)));
    expect(second).toBe(await buildSiteCss(resources, options(shownPage)));
  });

  it("keeps no compiler that failed to prepare: the next build prepares one again", async () => {
    const styles = createStyleCompiler(resources);
    compile.mockRejectedValueOnce(new Error("no stylesheet"));

    await expect(styles.css(options(shownPage))).rejects.toThrow("no stylesheet");
    const css = await styles.css(options(shownPage));

    expect(compile).toHaveBeenCalledTimes(2);
    expect(css).toBe(await buildSiteCss(resources, options(shownPage)));
  });
});
