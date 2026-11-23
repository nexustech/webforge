import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFor,
  checked,
  ensureGitleaks,
  GITLEAKS_VERSION,
  GitleaksError,
  rangesToScan,
  scan,
} from "./gitleaks.js";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("buildFor (5.24)", () => {
  it("has a pinned build for Windows, macOS and Linux, on x64 and arm64", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      for (const arch of ["x64", "arm64"]) {
        const build = buildFor(platform, arch);
        expect(build?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(build?.url).toMatch(
          new RegExp(
            `^https://github\\.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_`,
          ),
        );
        expect(build?.zip).toBe(platform === "win32");
      }
    }
    expect(buildFor("linux", "x64")?.url).toMatch(/_linux_x64\.tar\.gz$/);
    expect(buildFor("win32", "x64")?.url).toMatch(/_windows_x64\.zip$/);
    expect(buildFor("darwin", "arm64")?.url).toMatch(/_darwin_arm64\.tar\.gz$/);
  });

  it("has none for a computer Gitleaks doesn't build for", () => {
    expect(buildFor("aix", "ppc64")).toBeUndefined();
  });
});

describe("checked (5.24)", () => {
  const bytes = new TextEncoder().encode("gitleaks");

  it("passes bytes with the pinned checksum, and refuses any others", () => {
    expect(() => checked(bytes, sha256(bytes))).not.toThrow();
    expect(() => checked(bytes, "0".repeat(64))).toThrow(GitleaksError);
    expect(() => checked(bytes, "0".repeat(64))).toThrow(/didn't match its pinned SHA-256/);
  });
});

describe("rangesToScan (5.24)", () => {
  const A = "a".repeat(40);
  const B = "b".repeat(40);
  const NONE = "0".repeat(40);
  const known = (sha: string) => sha !== "c".repeat(40);

  it("scans what each pushed ref adds", () => {
    expect(
      rangesToScan(
        [
          // An update: what's new since the remote's commit.
          `refs/heads/feat ${A} refs/heads/feat ${B}`,
          // A new branch: what no remote has yet.
          `refs/heads/new ${A} refs/heads/new ${NONE}`,
          // A deleted branch: nothing.
          `(delete) ${NONE} refs/heads/old ${B}`,
          "",
        ].join("\r\n"),
        known,
      ),
    ).toEqual([`${B}..${A}`, `${A} --not --remotes`]);
  });

  it("scans what no remote has when the remote's commit was never fetched, as after a force push", () => {
    expect(rangesToScan(`refs/heads/feat ${A} refs/heads/feat ${"c".repeat(40)}\n`, known)).toEqual(
      [`${A} --not --remotes`],
    );
  });

  it("scans nothing when nothing is pushed", () => {
    expect(rangesToScan("", known)).toEqual([]);
  });
});

describe("ensureGitleaks (5.24)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gitleaks-test-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const BINARY = new TextEncoder().encode("a made-up archive");
  /** Installs on Linux x64 from what `download` gives, its archive holding just those bytes. */
  const install = (download: (url: string) => Promise<Uint8Array>) => ({
    platform: "linux" as const,
    arch: "x64",
    download,
    extract: vi.fn((archive: string, into: string) =>
      writeFileSync(join(into, "gitleaks"), readFileSync(archive)),
    ),
  });

  it("refuses a download whose checksum is wrong, and leaves nothing to run", async () => {
    const options = install(async () => BINARY);
    await expect(ensureGitleaks(dir, options)).rejects.toThrow(/didn't match its pinned SHA-256/);
    expect(options.extract).not.toHaveBeenCalled();
    expect(existsSync(join(dir, GITLEAKS_VERSION, "gitleaks"))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("stops the push, saying why, when it can't be downloaded", async () => {
    const options = install(async () => {
      throw new Error("getaddrinfo ENOTFOUND github.com");
    });
    await expect(ensureGitleaks(dir, options)).rejects.toThrow(GitleaksError);
    await expect(ensureGitleaks(dir, options)).rejects.toThrow(
      /Couldn't download Gitleaks .*ENOTFOUND[\s\S]*push again/,
    );
  });

  it("stops when Gitleaks has no build for the computer", async () => {
    const options = { ...install(async () => BINARY), platform: "aix" as const, arch: "ppc64" };
    await expect(ensureGitleaks(dir, options)).rejects.toThrow(/has no build for aix/);
  });

  it("downloads nothing once it's there", async () => {
    const binary = join(dir, GITLEAKS_VERSION, "gitleaks");
    const download = vi.fn(async () => BINARY);
    const options = install(download);
    mkdirSync(join(dir, GITLEAKS_VERSION));
    writeFileSync(binary, "");
    await expect(ensureGitleaks(dir, options)).resolves.toBe(binary);
    expect(download).not.toHaveBeenCalled();
  });
});

describe("scan (5.24, PR 1346's review)", () => {
  /** Gitleaks as if it exited with `status`. */
  const exits = (status: number) => (_binary: string, args: readonly string[]) => {
    expect(args).toEqual(expect.arrayContaining(["--exit-code", "2", "--redact"]));
    if (status !== 0) throw Object.assign(new Error(`exit ${status}`), { status });
  };

  it("finds nothing when Gitleaks passes, and a secret when it exits 2", () => {
    expect(scan("gitleaks", "/repo", "a..b", exits(0))).toBe(false);
    expect(scan("gitleaks", "/repo", "a..b", exits(2))).toBe(true);
  });

  it("stops as an error, not a finding, when Gitleaks can't scan, as with a broken .gitleaks.toml", () => {
    // Gitleaks exits 1 for a config it can't read.
    expect(() => scan("gitleaks", "/repo", undefined, exits(1))).toThrow(GitleaksError);
    expect(() => scan("gitleaks", "/repo", undefined, exits(1))).toThrow(
      /couldn't scan the commits \(exit 1[\s\S]*\.gitleaks\.toml/,
    );
  });
});
