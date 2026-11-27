/**
 * Each release of Webforge and the storage format it writes (#1525, UC-2), oldest first: how a
 * copy kept from before an update names the versions that can open it. A file doesn't record the
 * version that last saved it; a `saved_by` key arrives with the next format change that has a
 * reason of its own (coordinator, 26 Nov 2026). Each release adds itself here
 * (`docs/releasing.md`); a test fails while the current format has no release.
 */
export const RELEASES: readonly { readonly version: string; readonly fileFormat: number }[] = [
  { version: "0.1.0", fileFormat: 2 },
  { version: "0.2.0", fileFormat: 2 },
  { version: "0.3.0", fileFormat: 2 },
  { version: "0.3.1", fileFormat: 2 },
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
 * The releases before `current` that wrote file format `fileFormat`, as the first and the last
 * of them ("0.1.0" to "0.3.0"): one of them saved a file kept in that format before `current`
 * first changed it. `undefined` when no release wrote it (a development build's).
 */
export function releasesThatWrote(
  fileFormat: number,
  current: string,
): { readonly first: string; readonly last: string } | undefined {
  const wrote = RELEASES.filter(
    (release) => release.fileFormat === fileFormat && compareVersions(release.version, current) < 0,
  );
  const [first] = wrote;
  const last = wrote.at(-1);
  return first === undefined || last === undefined
    ? undefined
    : { first: first.version, last: last.version };
}
