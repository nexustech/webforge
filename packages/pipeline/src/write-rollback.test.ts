import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeSiteFolder } from "./write.js";

// Fails chosen renames, which a real disk only does under conditions tests cannot set up
// portably (a folder locked by another program, a full disk).
const failures = vi.hoisted(() => ({
  matching: null as RegExp | null,
  code: "EIO",
  removing: null as RegExp | null,
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      if (failures.matching?.test(`${from} -> ${to}`)) {
        throw Object.assign(new Error("rename failed"), { code: failures.code });
      }
      return actual.rename(from, to);
    },
    rm: async (path: string, options?: Parameters<typeof actual.rm>[1]) => {
      if (failures.removing?.test(path)) {
        throw Object.assign(new Error("rm failed"), { code: "EBUSY" });
      }
      return actual.rm(path, options);
    },
  };
});

const tempDir = tempDirFactory("webforge-pipeline-rollback-");
const site = (version: string) =>
  new Map([["index.html", new TextEncoder().encode(`<p>${version}</p>`)]]);

beforeEach(() => {
  failures.matching = null;
  failures.removing = null;
  failures.code = "EIO";
});

describe("writeSiteFolder rollback", () => {
  it("puts the previous export back when the new one cannot be moved into place", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");
    await writeSiteFolder(site("v1"), destination);
    failures.matching = /webforge-new-.* -> .*my-site$/;

    await expect(writeSiteFolder(site("v2"), destination)).rejects.toMatchObject({
      code: "write-failed",
    });
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v1</p>");
    expect(readdirSync(parent)).toEqual(["my-site"]);
  });

  it("gives up after retrying a folder Windows keeps locked", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");
    await writeSiteFolder(site("v1"), destination);
    failures.matching = /my-site -> .*webforge-old-/;
    failures.code = "EBUSY";

    await expect(writeSiteFolder(site("v2"), destination)).rejects.toMatchObject({
      code: "write-failed",
    });
    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v1</p>");
  }, 10_000);

  it("reports success when only deleting the old copy fails", async () => {
    const parent = tempDir();
    const destination = join(parent, "my-site");
    await writeSiteFolder(site("v1"), destination);
    failures.removing = /webforge-old-/;

    await writeSiteFolder(site("v2"), destination);

    expect(readFileSync(join(destination, "index.html"), "utf8")).toBe("<p>v2</p>");
  });
});
