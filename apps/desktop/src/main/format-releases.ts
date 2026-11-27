import type { StoredFormats } from "@webforge/storage";

/**
 * Each release of Webforge and the formats it writes (#1525, UC-2), oldest first: how a copy kept
 * from before an update names the versions that can open it. The site's format changes in most
 * releases, the file's rarely, and a file opens in a release that has both formats, or newer ones.
 * A file doesn't record the version that last saved it; a `saved_by` key arrives with the next file
 * format change that has a reason of its own (coordinator, 26 Nov 2026). Each release adds itself
 * here (`docs/releasing.md`); a test fails while the current formats have no release.
 */
export const RELEASES: readonly ({ readonly version: string } & StoredFormats)[] = [
  { version: "0.1.0", fileFormat: 2, siteFormat: 12 },
  { version: "0.2.0", fileFormat: 2, siteFormat: 15 },
  { version: "0.3.0", fileFormat: 2, siteFormat: 17 },
  { version: "0.3.1", fileFormat: 2, siteFormat: 22 },
];

/** `a` against `b` as versions, part by part: negative, zero or positive. */
function compareVersions(a: string, b: string): number {
  const parts = (version: string) => version.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const [left, right] = [parts(a), parts(b)];
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The releases before `current` that open a file kept in `formats`, as the first and the last of
 * them ("0.1.0" to "0.3.1", or "0.3.1" to "0.3.1" for one): those with its file format and its
 * site format or a newer one. `current` first wrote it in a newer format, so the copy is for the
 * versions before it. `undefined` when no release opens it (a development build's file).
 */
export function releasesThatOpen(
  formats: StoredFormats,
  current: string,
): { readonly first: string; readonly last: string } | undefined {
  const open = RELEASES.filter(
    (release) =>
      release.fileFormat === formats.fileFormat &&
      release.siteFormat >= formats.siteFormat &&
      compareVersions(release.version, current) < 0,
  );
  const [first] = open;
  const last = open.at(-1);
  return first === undefined || last === undefined
    ? undefined
    : { first: first.version, last: last.version };
}
