import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleSite } from "@webforge/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCodeTrust, withTrustedCode } from "./code-trust.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-code-trust-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const SITE = "8f7c2a9e-1b3d-4e5f-9a7b-2c4d6e8f0a1b";
const OTHER = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";

describe("code trust (#649)", () => {
  it("trusts what was trusted for that site only, from now on and in the next run", async () => {
    const trust = createCodeTrust({ dir });
    expect((await trust.trusted(SITE))("<script>mine()</script>")).toBe(false);

    await trust.trust(SITE, ["<script>mine()</script>", "go()"]);

    const now = await trust.trusted(SITE);
    expect(now("<script>mine()</script>")).toBe(true);
    expect(now("go()")).toBe(true);
    expect(now("go() ")).toBe(false);
    expect((await trust.trusted(OTHER))("go()")).toBe(false);
    expect((await createCodeTrust({ dir }).trusted(SITE))("go()")).toBe(true);
  });

  it("keeps hashes, never the code, and the newest when a site has its most", async () => {
    const trust = createCodeTrust({ dir, max: 2 });
    await trust.trust(SITE, ["first"]);
    await trust.trust(SITE, ["second", "third"]);
    await trust.trust(SITE, ["second"]);
    await trust.idle();

    const file = readFileSync(join(dir, "code-trust.json"), "utf8");
    expect(file).not.toContain("second");
    const trusted = await createCodeTrust({ dir, max: 2 }).trusted(SITE);
    expect(["first", "second", "third"].map(trusted)).toEqual([false, true, true]);
  });

  it("trusts nothing in a damaged file, and keeps working", async () => {
    writeFileSync(join(dir, "code-trust.json"), "{ not json");
    const trust = createCodeTrust({ dir });

    expect((await trust.trusted(SITE))("go()")).toBe(false);
    await trust.trust(SITE, ["go()"]);
    expect((await createCodeTrust({ dir }).trusted(SITE))("go()")).toBe(true);
  });
});

describe("withTrustedCode (#649)", () => {
  const snapshot = () => ({
    ...sampleSite(),
    code: { css: ".x {}", js: "skim()", head: "<b>mine</b>", bodyEnd: "" },
  });

  it("leaves out of a build the code the site's owner hasn't trusted", async () => {
    const trust = createCodeTrust({ dir });
    await trust.trust(SITE, ["<b>mine</b>"]);

    const built = await withTrustedCode(snapshot(), SITE, trust);

    expect(built.code).toEqual({ css: ".x {}", js: "", head: "<b>mine</b>", bodyEnd: "" });
  });

  it("leaves all of it out with no site open, or when the record can't be read", async () => {
    const broken = { trusted: async () => Promise.reject(new Error("locked")) };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      (await withTrustedCode(snapshot(), undefined, createCodeTrust({ dir }))).code?.head,
    ).toBe("");
    expect((await withTrustedCode(snapshot(), SITE, broken)).code?.js).toBe("");
    quiet.mockRestore();
  });
});
