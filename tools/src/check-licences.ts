// Licence check (rule C1): every installed dependency must have a permissive licence.
//
// Usage (see the root "licence-check" script):
//   pnpm licenses list -r --json | node tools/src/check-licences.ts
//
// This file has no relative imports so Node can run it directly with type stripping.

import { text } from "node:stream/consumers";
import { z } from "zod";

/**
 * SPDX licence IDs allowed for any dependency (C1). MPL-2.0 is allowed only for unmodified use;
 * we never patch dependencies, so it is accepted here.
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
]);

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
    if (
      token === undefined ||
      token === ")" ||
      token === "AND" ||
      token === "OR" ||
      token === "WITH"
    ) {
      return null;
    }
    if (token === "(") {
      const inner = parseOr();
      return next() === ")" ? inner : null;
    }
    if (peek() === "WITH") {
      next();
      const exception = next();
      if (exception === undefined || exception === "(" || exception === ")") {
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

async function main(): Promise<void> {
  const packages = parseLicenceReport(await text(process.stdin));
  const violations = findLicenceViolations(packages);
  if (violations.length > 0) {
    console.error(formatViolations(violations));
    process.exitCode = 1;
    return;
  }
  console.log(`Licence check passed: ${packages.length} packages, all with allowed licences.`);
}

if (import.meta.main) {
  await main();
}
