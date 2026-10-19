import { isDraft, original } from "immer";

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  if (Array.isArray(value)) {
    return true;
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUnchanged(current: unknown, next: unknown): boolean {
  return Object.is(current, next) || (isDraft(current) && original(current) === next);
}

function syncValue(target: Container, key: string | number, next: unknown): void {
  const current = (target as Record<string | number, unknown>)[key];
  if (isUnchanged(current, next)) {
    return;
  }
  if (isContainer(current) && isContainer(next) && Array.isArray(current) === Array.isArray(next)) {
    syncContainer(current, next);
    return;
  }
  (target as Record<string | number, unknown>)[key] = next;
}

function syncContainer(target: Container, next: Container): void {
  if (Array.isArray(target) && Array.isArray(next)) {
    const shared = Math.min(target.length, next.length);
    for (let index = 0; index < shared; index++) {
      syncValue(target, index, next[index]);
    }
    if (target.length > next.length) {
      target.splice(next.length);
    } else {
      target.push(...next.slice(shared));
    }
    return;
  }
  const record = target as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!Object.hasOwn(nextRecord, key)) {
      delete record[key];
    }
  }
  for (const [key, value] of Object.entries(nextRecord)) {
    syncValue(record, key, value);
  }
}

/**
 * Makes `draft` deep-equal to `next`, writing only what differs. Used when another component (the
 * canvas engine) hands over a whole new value: the resulting patches stay as small as the actual
 * change, e.g. one `replace` of a heading's text, rather than a replace of the whole page.
 * Subtrees of `next` that are the same objects as in the draft's original are skipped without
 * being visited.
 */
export function syncDraft<T extends object>(draft: T, next: T): void {
  syncContainer(draft as Container, next as Container);
}
