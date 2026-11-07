import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectNotices,
  dependencyDirs,
  findPackageDir,
  formatNotices,
  NOTICES_FILE,
  NOTICES_TEXT_FILE,
  packageDirOf,
  writeNotices,
} from "./third-party-notices.js";

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "webforge-notices-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Writes package `name` under `node_modules` in `at` with `manifest` and `files`; its folder. */
function install(
  at: string,
  name: string,
  manifest: Record<string, unknown> = {},
  files: Record<string, string> = {},
): string {
  const dir = join(at, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", ...manifest }));
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}

describe("packageDirOf", () => {
  it("names the package a bundled file belongs to, scoped or not, in pnpm's layout", () => {
    expect(
      packageDirOf("C:\\repo\\node_modules\\.pnpm\\react@19.2.0\\node_modules\\react\\index.js"),
    ).toBe("C:/repo/node_modules/.pnpm/react@19.2.0/node_modules/react");
    expect(packageDirOf("/repo/node_modules/@jsquash/webp/codec/enc.wasm?inline")).toBe(
      "/repo/node_modules/@jsquash/webp",
    );
  });

  it("leaves out the app's own files, virtual modules and pnpm's own folders", () => {
    expect(packageDirOf("/repo/packages/model/src/index.ts")).toBeUndefined();
    expect(packageDirOf("\0commonjsHelpers.js")).toBeUndefined();
    expect(packageDirOf("/repo/node_modules/.pnpm/lock.yaml")).toBeUndefined();
    expect(packageDirOf("/repo/node_modules/@scope")).toBeUndefined();
  });
});

describe("dependencyDirs", () => {
  it("finds the main process's dependencies and all of theirs, as electron-builder copies them", () => {
    const app = join(root, "app");
    mkdirSync(app);
    install(app, "ssh2", {
      dependencies: { asn1: "1" },
      optionalDependencies: { "cpu-features": "1" },
    });
    install(root, "asn1", { dependencies: { "safer-buffer": "1" } });
    install(root, "safer-buffer");

    const dirs = [...dependencyDirs(app, ["ssh2"])].map((dir) => readManifestName(dir));
    // cpu-features is optional and not installed: skipped.
    expect(dirs.sort()).toEqual(["asn1", "safer-buffer", "ssh2"]);
    expect(() => dependencyDirs(app, ["not-installed"])).toThrow("isn't installed");
  });

  it("resolves a package as Node does, from the nearest node_modules up", () => {
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });
    const dir = install(root, "react");
    expect(findPackageDir(nested, "react")).toBe(dir);
    expect(findPackageDir(nested, "vue")).toBeUndefined();
  });
});

const readManifestName = (dir: string) =>
  (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string }).name;

describe("collectNotices", () => {
  it("lists each package once, with its licence, home page and licence files, sorted by name", () => {
    const zod = install(
      root,
      "zod",
      { license: "MIT", repository: { url: "git+https://github.com/colinhacks/zod.git" } },
      { LICENSE: "MIT Licence\r\nCopyright Colin" },
    );
    const font = install(
      root,
      "@fontsource/inter",
      { license: "OFL-1.1", homepage: "https://fontsource.org/fonts/inter" },
      { LICENSE: "SIL Open Font License" },
    );
    const apache = install(
      root,
      "apache",
      { licenses: [{ type: "MIT" }, { type: "Apache-2.0" }] },
      { "LICENSE-APACHE": "Apache", NOTICE: "Notice", "license.js": "not a licence" },
    );
    const bare = install(root, "bare");
    const ours = install(root, "@webforge/model", { license: "UNLICENSED" });

    const notices = collectNotices([zod, font, apache, bare, ours, zod]);

    expect(notices).toEqual([
      {
        name: "@fontsource/inter",
        version: "1.0.0",
        licence: "OFL-1.1",
        homepage: "https://fontsource.org/fonts/inter",
        text: "SIL Open Font License",
      },
      {
        name: "apache",
        version: "1.0.0",
        licence: "(MIT OR Apache-2.0)",
        text: "Apache\n\nNotice",
      },
      { name: "bare", version: "1.0.0", licence: "UNKNOWN" },
      {
        name: "zod",
        version: "1.0.0",
        licence: "MIT",
        homepage: "https://github.com/colinhacks/zod",
        text: "MIT Licence\nCopyright Colin",
      },
    ]);
  });
});

describe("writeNotices", () => {
  it("writes the screen's JSON and the plain-text notices, Chromium's named", async () => {
    const notices = [{ name: "zod", version: "4.0.0", licence: "MIT", text: "MIT Licence" }];
    const target = join(root, "out", "notices");
    await writeNotices(target, notices);

    expect(JSON.parse(readFileSync(join(target, NOTICES_FILE), "utf8"))).toEqual({
      packages: notices,
    });
    const text = readFileSync(join(target, NOTICES_TEXT_FILE), "utf8");
    expect(text).toBe(formatNotices(notices));
    expect(text).toContain("zod 4.0.0\nLicence: MIT\n\nMIT Licence");
    expect(text).toContain("LICENSES.chromium.html");
    expect(formatNotices([{ name: "bare", version: "1.0.0", licence: "MIT" }])).toContain(
      "(The package includes no licence file.)",
    );
  });
});
