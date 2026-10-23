import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CACHE_VOLUME,
  containerScript,
  dockerArgs,
  parseArgs,
  playwrightImage,
} from "./visual-docker.js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("parseArgs", () => {
  it("defaults to writing only missing screenshots", () => {
    expect(parseArgs([])).toEqual({ update: false, playwrightArgs: [] });
  });

  it("reads --update and passes what follows -- to Playwright", () => {
    expect(parseArgs(["--update", "--", "--grep", "Picker"])).toEqual({
      update: true,
      playwrightArgs: ["--grep", "Picker"],
    });
  });

  it("refuses unknown options before --", () => {
    expect(() => parseArgs(["--grep", "Picker"])).toThrow(/Unknown option --grep Picker/);
  });
});

describe("playwrightImage", () => {
  it("uses the Playwright image of the pinned version", () => {
    const pkg = JSON.stringify({ devDependencies: { "@playwright/test": "1.64.1" } });
    expect(playwrightImage(pkg)).toBe("mcr.microsoft.com/playwright:v1.64.1-noble");
  });

  it("refuses a version range, which would not name one image", () => {
    const pkg = JSON.stringify({ devDependencies: { "@playwright/test": "^1.64.1" } });
    expect(() => playwrightImage(pkg)).toThrow(/exact version/);
  });

  // Local screenshots only match CI's when both use the same container.
  it("matches the container of CI's Storybook job", () => {
    const image = playwrightImage(read("e2e/package.json"));
    const ci = read(".github/workflows/ci.yml");
    const visualJob = ci.slice(ci.indexOf("\n  visual:"), ci.indexOf("\n  package:"));
    expect(visualJob).toContain(`container: ${image}`);
  });
});

describe("containerScript", () => {
  it("runs CI's Storybook build and visual tests with screenshots", () => {
    const script = containerScript({ update: false, playwrightArgs: [] });
    expect(script).toContain("VISUAL_SCREENSHOTS=1");
    expect(script).toContain("pnpm install --frozen-lockfile");
    expect(script).toContain(
      "pnpm --filter @webforge/editor-ui --filter @webforge/site-components build-storybook",
    );
    expect(script).toContain("e2e:visual --update-snapshots=missing");
  });

  it("rewrites changed screenshots with --update", () => {
    expect(containerScript({ update: true, playwrightArgs: [] })).toContain(
      "--update-snapshots=changed",
    );
  });

  it("copies the tree without node_modules or git, and copies the screenshots back", () => {
    const script = containerScript({ update: false, playwrightArgs: [] });
    expect(script).toContain("--exclude=node_modules");
    expect(script).toContain("--exclude=./.git");
    expect(script).toContain(
      "cp -r /work/e2e/visual/__screenshots__/. /src/e2e/visual/__screenshots__/",
    );
  });

  it("quotes Playwright arguments for bash", () => {
    const script = containerScript({ update: false, playwrightArgs: ["--grep", "it's a test"] });
    expect(script).toContain("'--grep' 'it'\\''s a test'");
  });
});

describe("dockerArgs", () => {
  it("mounts the repository and the cache volume and runs the script with bash", () => {
    const options = { update: false, playwrightArgs: [] };
    const args = dockerArgs("C:/repo", "image:tag", options);
    expect(args.slice(0, 9)).toEqual([
      "run",
      "--rm",
      "--init",
      "--ipc=host",
      "-v",
      "C:/repo:/src",
      "-v",
      `${CACHE_VOLUME}:/cache`,
      "image:tag",
    ]);
    expect(args.slice(9)).toEqual(["bash", "-c", containerScript(options)]);
  });
});

describe("root script", () => {
  it("runs this file", () => {
    const { scripts } = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(scripts["visual:docker"]).toBe("node tools/src/visual-docker.ts");
  });
});
