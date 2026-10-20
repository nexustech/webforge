import type { PuckAction } from "@puckeditor/core";
import type { NodeDoc, PageDoc } from "@webforge/model";
import { findNode, ROOT_ZONE } from "./tree.js";

/** The slot fields of a component type, or `undefined` for a type the canvas doesn't know. */
export type SlotsOf = (type: string) => readonly string[] | undefined;

/** A list of nodes whose members or order changed. */
type ChangedList = {
  readonly zone: string;
  readonly before: readonly NodeDoc[];
  readonly after: readonly NodeDoc[];
};

/** Thrown inside {@link pageActions} for a change it doesn't translate. */
class Untranslatable extends Error {}

const idsOf = (list: readonly NodeDoc[]) => list.map((node) => node.props.id);

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** The index whose removal from `longer` leaves `shorter`, if there is exactly such a one. */
function extraIndex(longer: readonly string[], shorter: readonly string[]): number | undefined {
  if (longer.length !== shorter.length + 1) {
    return undefined;
  }
  let index = 0;
  while (index < shorter.length && longer[index] === shorter[index]) {
    index++;
  }
  return sameIds(longer.slice(index + 1), shorter.slice(index)) ? index : undefined;
}

/** `[from, to]` if `after` is `before` with one id moved from `from` to `to`. */
function movedIndex(before: readonly string[], after: readonly string[]): [number, number] | null {
  if (before.length !== after.length) {
    return null;
  }
  let first = 0;
  while (first < before.length && before[first] === after[first]) {
    first++;
  }
  let last = before.length - 1;
  while (last > first && before[last] === after[last]) {
    last--;
  }
  const slice = (list: readonly string[], from: number, to: number) => list.slice(from, to + 1);
  // Moved down: before[first] now sits at `last`, the ones in between shifted up.
  if (
    after[last] === before[first] &&
    sameIds(slice(before, first + 1, last), slice(after, first, last - 1))
  ) {
    return [first, last];
  }
  // Moved up: before[last] now sits at `first`.
  if (
    after[first] === before[last] &&
    sameIds(slice(before, first, last - 1), slice(after, first + 1, last))
  ) {
    return [last, first];
  }
  return null;
}

/**
 * Translates a change of the page into Puck's atomic actions (`replace`, `insert`, `remove`,
 * `move`, `replaceRoot`), so Puck updates only what changed instead of re-indexing and comparing the
 * whole page as it does for `setData` (ADR 0007).
 *
 * Unchanged parts are recognised by reference, as the document store shares them between versions.
 * Any number of changed elements become `replace` actions; at most one element may be added,
 * removed or moved, which covers every single undo or redo step. For anything else, such as a
 * jump over several steps, it returns `null` and the caller sends the whole page.
 */
export function pageActions(
  before: PageDoc,
  after: PageDoc,
  slotsOf: SlotsOf,
): PuckAction[] | null {
  const replaces: PuckAction[] = [];
  const changedLists: ChangedList[] = [];

  const compareNodes = (zone: string, index: number, old: NodeDoc, node: NodeDoc) => {
    if (old === node) {
      return;
    }
    const slots = slotsOf(node.type);
    if (old.type !== node.type || slots === undefined) {
      throw new Untranslatable();
    }
    const keys = new Set([...Object.keys(old.props), ...Object.keys(node.props)]);
    const changed = [...keys].some(
      (key) => !slots.includes(key) && !Object.is(old.props[key], node.props[key]),
    );
    if (changed) {
      // Replacing the node also brings its slots up to date.
      replaces.push({
        type: "replace",
        destinationZone: zone,
        destinationIndex: index,
        data: node,
      });
      return;
    }
    for (const slot of slots) {
      compareLists(`${node.props.id}:${slot}`, listOf(old, slot), listOf(node, slot));
    }
  };

  const compareLists = (zone: string, old: readonly NodeDoc[], list: readonly NodeDoc[]) => {
    if (old === list) {
      return;
    }
    if (sameIds(idsOf(old), idsOf(list))) {
      for (const [index, node] of list.entries()) {
        compareNodes(zone, index, old[index] as NodeDoc, node);
      }
      return;
    }
    changedLists.push({ zone, before: old, after: list });
    // The elements it kept, at their new positions: the replaces run after the structural action.
    const previous = new Map(old.map((node) => [node.props.id, node]));
    for (const [index, node] of list.entries()) {
      const kept = previous.get(node.props.id);
      if (kept !== undefined) {
        compareNodes(zone, index, kept, node);
      }
    }
  };

  /** The actions for the added, removed or moved element. */
  const structural = (): PuckAction[] => {
    const [first, second] = changedLists;
    if (first === undefined) {
      return [];
    }
    if (second === undefined) {
      return withinList(first);
    }
    if (changedLists.length === 2) {
      return betweenLists(first, second) ?? betweenLists(second, first) ?? untranslatable();
    }
    return untranslatable();
  };

  const withinList = (list: ChangedList): PuckAction[] => {
    const old = idsOf(list.before);
    const ids = idsOf(list.after);
    const removed = extraIndex(old, ids);
    if (removed !== undefined) {
      return [{ type: "remove", zone: list.zone, index: removed }];
    }
    const added = extraIndex(ids, old);
    const node = added === undefined ? undefined : list.after[added];
    if (added !== undefined && node !== undefined) {
      // A new element; one that moved here from elsewhere would have changed two lists.
      if (findNode(before, node.props.id) !== undefined || slotsOf(node.type) === undefined) {
        return untranslatable();
      }
      return [
        {
          type: "insert",
          componentType: node.type,
          id: node.props.id,
          destinationZone: list.zone,
          destinationIndex: added,
        },
        // Insert creates the element with its defaults; this gives it its props and children.
        { type: "replace", destinationZone: list.zone, destinationIndex: added, data: node },
      ];
    }
    const moved = movedIndex(old, ids);
    if (moved === null) {
      return untranslatable();
    }
    const [from, to] = moved;
    return [
      {
        type: "move",
        sourceZone: list.zone,
        sourceIndex: from,
        destinationZone: list.zone,
        destinationIndex: to,
      },
    ];
  };

  /** A move from `source` to `target`, if that is what changed them. */
  const betweenLists = (source: ChangedList, target: ChangedList): PuckAction[] | null => {
    const from = extraIndex(idsOf(source.before), idsOf(source.after));
    const to = extraIndex(idsOf(target.after), idsOf(target.before));
    if (from === undefined || to === undefined) {
      return null;
    }
    const old = source.before[from];
    const node = target.after[to];
    if (old === undefined || node === undefined || old.props.id !== node.props.id) {
      return null;
    }
    // The moved element may have changed as well, but nothing inside it may have moved.
    const lists = changedLists.length;
    compareNodes(target.zone, to, old, node);
    if (changedLists.length !== lists) {
      return untranslatable();
    }
    return [
      {
        type: "move",
        sourceZone: source.zone,
        sourceIndex: from,
        destinationZone: target.zone,
        destinationIndex: to,
      },
    ];
  };

  try {
    const actions: PuckAction[] = [];
    actions.push(...rootActions(before, after));
    compareLists(ROOT_ZONE, before.content, after.content);
    actions.push(...structural());
    return [...actions, ...replaces];
  } catch (error) {
    if (error instanceof Untranslatable) {
      return null;
    }
    throw error;
  }
}

function untranslatable(): never {
  throw new Untranslatable();
}

function listOf(node: NodeDoc, slot: string): readonly NodeDoc[] {
  const value = node.props[slot];
  return Array.isArray(value) ? (value as NodeDoc[]) : [];
}

/** Puck's `replaceRoot` merges props, so it can't express a removed one. */
function rootActions(before: PageDoc, after: PageDoc): PuckAction[] {
  const old = before.root.props;
  const props = after.root.props;
  if (old === props) {
    return [];
  }
  if (Object.keys(old).some((key) => !Object.hasOwn(props, key))) {
    return untranslatable();
  }
  const changed = Object.keys(props).some((key) => !Object.is(old[key], props[key]));
  return changed ? [{ type: "replaceRoot", root: { props } }] : [];
}
