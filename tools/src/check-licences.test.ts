import { describe, expect, it } from "vitest";
import {
  findLicenceViolations,
  formatViolations,
  isLicenceAllowed,
  type LicenceException,
  parseLicenceReport,
} from "./check-licences.js";

describe("isLicenceAllowed", () => {
  it.each(["MIT", "ISC", "Apache-2.0", "BSD-3-Clause", "MPL-2.0", "0BSD", "BlueOak-1.0.0"])(
    "allows %s",
    (licence) => {
      expect(isLicenceAllowed(licence)).toBe(true);
    },
  );

  it.each(["GPL-3.0-only", "AGPL-3.0-or-later", "LGPL-2.1", "UNLICENSED", "WTFPL", "CC-BY-4.0"])(
    "rejects %s",
    (licence) => {
      expect(isLicenceAllowed(licence)).toBe(false);
    },
  );

  it("allows an OR expression when either side is allowed", () => {
    expect(isLicenceAllowed("MIT OR Apache-2.0")).toBe(true);
    expect(isLicenceAllowed("(WTFPL OR MIT)")).toBe(true);
    expect(isLicenceAllowed("GPL-3.0-only OR MIT")).toBe(true);
  });

  it("requires both sides of an AND expression", () => {
    expect(isLicenceAllowed("Apache-2.0 AND MIT")).toBe(true);
    expect(isLicenceAllowed("MIT AND GPL-3.0-only")).toBe(false);
  });

  it("respects parentheses and AND binding tighter than OR", () => {
    expect(isLicenceAllowed("GPL-2.0-only OR (MIT AND ISC)")).toBe(true);
    expect(isLicenceAllowed("(GPL-2.0-only OR MIT) AND GPL-3.0-only")).toBe(false);
    expect(isLicenceAllowed("GPL-2.0-only AND MIT OR ISC")).toBe(true);
  });

  it("judges a WITH expression by its base licence", () => {
    expect(isLicenceAllowed("Apache-2.0 WITH LLVM-exception")).toBe(true);
    expect(isLicenceAllowed("GPL-2.0-only WITH Classpath-exception-2.0")).toBe(false);
  });

  it.each([
    "",
    "SEE LICENSE IN LICENSE.md",
    "MIT OR",
    "(MIT",
    "MIT)",
    "AND MIT",
    "MIT WITH",
    "MIT WITH )",
  ])("rejects the malformed expression %j", (expression) => {
    expect(isLicenceAllowed(expression)).toBe(false);
  });
});

describe("parseLicenceReport", () => {
  it("flattens pnpm's licence groups into packages", () => {
    const json = JSON.stringify({
      MIT: [{ name: "react", versions: ["19.3.1"], license: "MIT", paths: [] }],
      "Apache-2.0 AND MIT": [
        { name: "@swc/core-win32-x64-msvc", versions: ["1.16.18"], license: "Apache-2.0 AND MIT" },
      ],
    });

    expect(parseLicenceReport(json)).toEqual([
      { name: "react", versions: ["19.3.1"], licence: "MIT" },
      { name: "@swc/core-win32-x64-msvc", versions: ["1.16.18"], licence: "Apache-2.0 AND MIT" },
    ]);
  });

  it("throws on output with an unexpected shape", () => {
    expect(() => parseLicenceReport(JSON.stringify({ MIT: [{ name: "react" }] }))).toThrow();
    expect(() => parseLicenceReport("not json")).toThrow();
  });
});

describe("findLicenceViolations", () => {
  const exceptions = new Map<string, LicenceException>([
    ["argparse", { licence: "Python-2.0", reason: "Build-time only." }],
  ]);

  it("returns nothing when every licence is allowed or excepted", () => {
    const packages = [
      { name: "react", versions: ["19.3.1"], licence: "MIT" },
      { name: "argparse", versions: ["2.0.1"], licence: "Python-2.0" },
    ];

    expect(findLicenceViolations(packages, exceptions)).toEqual([]);
  });

  it("reports packages with disallowed licences", () => {
    const gpl = { name: "some-gpl-lib", versions: ["1.0.0"], licence: "GPL-3.0-only" };

    expect(findLicenceViolations([gpl], exceptions)).toEqual([gpl]);
  });

  it("re-checks an excepted package whose licence changed", () => {
    const changed = { name: "argparse", versions: ["3.0.0"], licence: "GPL-3.0-only" };

    expect(findLicenceViolations([changed], exceptions)).toEqual([
      { ...changed, staleException: { licence: "Python-2.0", reason: "Build-time only." } },
    ]);
  });

  it("uses the reviewed exception list by default", () => {
    const packages = [{ name: "caniuse-lite", versions: ["1.0.0"], licence: "CC-BY-4.0" }];

    expect(findLicenceViolations(packages)).toEqual([]);
  });
});

describe("formatViolations", () => {
  it("lists each package and explains how to fix it", () => {
    const output = formatViolations([
      { name: "some-gpl-lib", versions: ["1.0.0", "1.1.0"], licence: "GPL-3.0-only" },
      {
        name: "argparse",
        versions: ["3.0.0"],
        licence: "GPL-3.0-only",
        staleException: { licence: "Python-2.0", reason: "Build-time only." },
      },
    ]);

    expect(output).toContain("2 package(s)");
    expect(output).toContain("some-gpl-lib@1.0.0, 1.1.0: GPL-3.0-only");
    expect(output).toContain(
      'argparse@3.0.0: GPL-3.0-only (exception was reviewed for "Python-2.0")',
    );
    expect(output).toContain("pnpm why <name> -r");
  });
});
