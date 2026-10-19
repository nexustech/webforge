import type { Patch } from "immer";

type Path = Patch["path"];

function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

/** Whether `path` lies strictly below `ancestor`. */
function isBelow(path: Path, ancestor: Path): boolean {
  return (
    path.length > ancestor.length && ancestor.every((segment, index) => segment === path[index])
  );
}

/**
 * Removes patches that a later patch overwrites, so a coalesced history entry stays small (U7):
 * 200 keystrokes in one heading become one `replace` instead of 200.
 *
 * Only sequences made entirely of `replace` operations are compacted. `add` and `remove` shift
 * array indices, so dropping one would change what later patches point at. Within a replace-only
 * sequence a patch is dropped only if a later patch writes the same path and no patch in between
 * writes below that path (which could depend on the dropped value existing). Applying the result
 * gives the same document as applying the input.
 */
export function compactPatches(patches: readonly Patch[]): Patch[] {
  if (!patches.every((patch) => patch.op === "replace")) {
    return [...patches];
  }
  return patches.filter((patch, index) => {
    for (const later of patches.slice(index + 1)) {
      if (isBelow(later.path, patch.path)) {
        return true;
      }
      if (samePath(later.path, patch.path)) {
        return false;
      }
    }
    return true;
  });
}
