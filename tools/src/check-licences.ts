// Licence check (rule C1): every installed dependency must have a permissive licence.
//
// Usage (see the root "licence-check" script):
//   pnpm licenses list -r --json | node tools/src/check-licences.ts
//
// It also checks the packages pnpm-workspace.yaml patches (`patchedDependencies`): their licences
// must allow modification.
//
// This file has no relative imports so Node can run it directly with type stripping.

import { readFileSync } from "node:fs";
import { text } from "node:stream/consumers";
import { z } from "zod";

/**
 * SPDX licence IDs allowed for any dependency (C1). MPL-2.0 is allowed only for unmodified use: we
 * patch only permissively licensed packages (currently @puckeditor/core, MIT) and MPL-2.0 packages
 * are never patched, which {@link findPatchedViolations} enforces. OFL-1.1 covers the Fontsource fonts that
 * exported sites bundle (architecture §8): it allows embedding and redistributing the fonts with
 * any software, only not selling them on their own.
 */
export const ALLOWED_LICENCES: ReadonlySet<string> = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MPL-2.0",
  "OFL-1.1",
]);

/**
 * Licences a package may have if we patch it (`patchedDependencies` in pnpm-workspace.yaml): the
 * allowed ones except MPL-2.0, which allows only unmodified use.
 */
export const PATCHABLE_LICENCES: ReadonlySet<string> = new Set(
  [...ALLOWED_LICENCES].filter((licence) => licence !== "MPL-2.0"),
);

/** A package allowed despite a licence outside {@link ALLOWED_LICENCES}, with the reason. */
export type LicenceException = {
  /** The exact licence string the exception was reviewed for; a different licence is re-checked. */
  readonly licence: string;
  readonly reason: string;
};

/** Reviewed exceptions, by package name. Keep each reason specific: who pulls it in and why it is fine. */
export const LICENCE_EXCEPTIONS: ReadonlyMap<string, LicenceException> = new Map([
  [
    "argparse",
    {
      licence: "Python-2.0",
      reason: "Permissive PSF licence. Build-time only (electron-builder → js-yaml).",
    },
  ],
  [
    "caniuse-lite",
    {
      licence: "CC-BY-4.0",
      reason: "Browser support data used at build time (browserslist); not shipped in the app.",
    },
  ],
  [
    "truncate-utf8-bytes",
    {
      licence: "WTFPL",
      reason: "Permissive. Build-time only (electron-builder → sanitize-filename).",
    },
  ],
]);

const reportSchema = z.record(
  z.string(),
  z.array(
    z.object({
      name: z.string(),
      versions: z.array(z.string()),
      license: z.string(),
    }),
  ),
);

/** One installed package as `pnpm licenses list --json` reports it. */
export type LicensedPackage = {
  readonly name: string;
  readonly versions: readonly string[];
  readonly licence: string;
};

/** Parses the JSON output of `pnpm licenses list -r --json`. Throws if it has an unexpected shape. */
export function parseLicenceReport(json: string): LicensedPackage[] {
  const report = reportSchema.parse(JSON.parse(json));
  return Object.values(report)
    .flat()
    .map((entry) => ({ name: entry.name, versions: entry.versions, licence: entry.license }));
}

const OPERATORS_AND_PARENS: ReadonlySet<string> = new Set(["AND", "OR", "WITH", "(", ")"]);

/**
 * Whether an SPDX licence expression is acceptable: `A OR B` needs one side allowed, `A AND B`
 * both, and `A WITH exception` is judged by `A` (exceptions only add permissions).
 * Anything that is not a valid expression (e.g. "UNLICENSED", "SEE LICENSE IN …") is rejected.
 */
export function isLicenceAllowed(
  expression: string,
  allowed: ReadonlySet<string> = ALLOWED_LICENCES,
): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let position = 0;

  const peek = (): string | undefined => tokens[position];
  const next = (): string | undefined => tokens[position++];

  function parseOr(): boolean | null {
    let result = parseAnd();
    while (result !== null && peek() === "OR") {
      next();
      const right = parseAnd();
      result = right === null ? null : result || right;
    }
    return result;
  }

  function parseAnd(): boolean | null {
    let result = parseAtom();
    while (result !== null && peek() === "AND") {
      next();
      const right = parseAtom();
      result = right === null ? null : result && right;
    }
    return result;
  }

  function parseAtom(): boolean | null {
    const token = next();
    if (token === undefined || (token !== "(" && OPERATORS_AND_PARENS.has(token))) {
      return null;
    }
    if (token === "(") {
      const inner = parseOr();
      return next() === ")" ? inner : null;
    }
    if (peek() === "WITH") {
      next();
      const exception = next();
      if (exception === undefined || OPERATORS_AND_PARENS.has(exception)) {
        return null;
      }
    }
    return allowed.has(token);
  }

  const result = parseOr();
  return result === true && position === tokens.length;
}

/** A package whose licence is not allowed. */
export type LicenceViolation = LicensedPackage & {
  /** Set when an exception exists for the package but was reviewed for a different licence. */
  readonly staleException?: LicenceException;
};

/** Returns the packages whose licences are neither allowed nor covered by a matching exception. */
export function findLicenceViolations(
  packages: readonly LicensedPackage[],
  exceptions: ReadonlyMap<string, LicenceException> = LICENCE_EXCEPTIONS,
): LicenceViolation[] {
  const violations: LicenceViolation[] = [];
  for (const pkg of packages) {
    if (isLicenceAllowed(pkg.licence)) {
      continue;
    }
    const exception = exceptions.get(pkg.name);
    if (exception?.licence === pkg.licence) {
      continue;
    }
    violations.push(exception === undefined ? pkg : { ...pkg, staleException: exception });
  }
  return violations;
}

/** Formats violations for the console, one package per line plus how to investigate. */
export function formatViolations(violations: readonly LicenceViolation[]): string {
  const lines = violations.map((violation) => {
    const id = `${violation.name}@${violation.versions.join(", ")}`;
    const stale =
      violation.staleException === undefined
        ? ""
        : ` (exception was reviewed for "${violation.staleException.licence}")`;
    return `  ✘ ${id}: ${violation.licence}${stale}`;
  });
  return [
    `Licence check failed: ${violations.length} package(s) without an allowed licence (C1).`,
    ...lines,
    "",
    "Find who depends on a package with `pnpm why <name> -r`. Replace it, or add a reviewed",
    "entry to LICENCE_EXCEPTIONS in tools/src/check-licences.ts.",
  ].join("\n");
}

/** Names of excepted packages that are not installed; their entries should be removed. */
export function findUnusedExceptions(
  packages: readonly LicensedPackage[],
  exceptions: ReadonlyMap<string, LicenceException> = LICENCE_EXCEPTIONS,
): string[] {
  const installed = new Set(packages.map((pkg) => pkg.name));
  return [...exceptions.keys()].filter((name) => !installed.has(name));
}

/**
 * The names of the packages pnpm-workspace.yaml patches: the keys of its `patchedDependencies`,
 * such as `'@puckeditor/core@0.23.0'`, without their versions.
 */
export function parsePatchedPackages(workspaceYaml: string): string[] {
  const lines = workspaceYaml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^patchedDependencies:/.test(line));
  if (start === -1) {
    return [];
  }
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) {
      break; // The next top-level key.
    }
    const key = /^\s+(['"]?)([^'"#\s][^'"]*?)\1\s*:/.exec(line)?.[2];
    if (key !== undefined) {
      const at = key.lastIndexOf("@");
      names.push(at > 0 ? key.slice(0, at) : key);
    }
  }
  return names;
}

/** The patched packages whose licences don't allow modification (see {@link PATCHABLE_LICENCES}). */
export function findPatchedViolations(
  packages: readonly LicensedPackage[],
  patched: readonly string[],
): LicensedPackage[] {
  const names = new Set(patched);
  return packages.filter(
    (pkg) => names.has(pkg.name) && !isLicenceAllowed(pkg.licence, PATCHABLE_LICENCES),
  );
}

/** Outcome of a licence check: whether it passed and what to print. */
export type LicenceCheckResult = {
  readonly ok: boolean;
  readonly message: string;
  readonly warnings: readonly string[];
};

/**
 * Checks the JSON output of `pnpm licenses list -r --json`, and that none of the `patched` packages
 * has a licence that forbids modifying it. An empty report fails: it means the listing went wrong,
 * not that there is nothing to check.
 */
export function checkLicenceReport(
  json: string,
  exceptions: ReadonlyMap<string, LicenceException> = LICENCE_EXCEPTIONS,
  patched: readonly string[] = [],
): LicenceCheckResult {
  const packages = parseLicenceReport(json);
  if (packages.length === 0) {
    return {
      ok: false,
      message: "Licence check failed: the licence report lists no packages. Run `pnpm install`.",
      warnings: [],
    };
  }
  // Unused exceptions are only warnings: some packages are installed on one OS only.
  const warnings = findUnusedExceptions(packages, exceptions).map(
    (name) => `Warning: licence exception for "${name}" matches no installed package.`,
  );
  const violations = findLicenceViolations(packages, exceptions);
  if (violations.length > 0) {
    return { ok: false, message: formatViolations(violations), warnings };
  }
  const patchedViolations = findPatchedViolations(packages, patched);
  if (patchedViolations.length > 0) {
    const lines = patchedViolations.map(
      (pkg) => `  ${pkg.name}@${pkg.versions.join(", ")}: ${pkg.licence}`,
    );
    return {
      ok: false,
      message: [
        "Licence check failed: these patched packages have licences that allow only unmodified use:",
        ...lines,
        "Remove the patch (patchedDependencies in pnpm-workspace.yaml) or replace the package.",
      ].join("\n"),
      warnings,
    };
  }
  return {
    ok: true,
    message: `Licence check passed: ${packages.length} packages, all with allowed licences.`,
    warnings,
  };
}

async function main(): Promise<void> {
  if (process.stdin.isTTY) {
    console.error("Usage: pnpm licenses list -r --json | node tools/src/check-licences.ts");
    console.error("(or run `pnpm licence-check` from the repository root)");
    process.exitCode = 2;
    return;
  }
  const workspace = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
  const result = checkLicenceReport(
    await text(process.stdin),
    LICENCE_EXCEPTIONS,
    parsePatchedPackages(workspace),
  );
  for (const warning of result.warnings) {
    console.warn(warning);
  }
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
