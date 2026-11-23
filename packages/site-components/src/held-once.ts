import { isNodeDoc, type NodeDoc } from "@webforge/model";

/** What {@link secondOfOne} reads of a component's fields: its slots' `once`. */
export type OnceFields = (
  type: string,
) =>
  | Readonly<
      Record<string, { readonly kind: string; readonly once?: readonly string[] | undefined }>
    >
  | undefined;

/** The nodes in a slot's value. */
const childrenIn = (value: unknown): readonly NodeDoc[] =>
  Array.isArray(value) ? value.filter(isNodeDoc) : [];

/** How many nodes of `type` `nodes` hold, at any depth, the node `leaving` and its own aside. */
export function countOfType(nodes: readonly NodeDoc[], type: string, leaving?: string): number {
  let count = 0;
  for (const node of nodes) {
    if (node.props.id === leaving) continue;
    if (node.type === type) count += 1;
    for (const value of Object.values(node.props)) {
      count += countOfType(childrenIn(value), type, leaving);
    }
  }
  return count;
}

/** Whether `nodes` hold the node `id`, at any depth. */
const holdsId = (nodes: readonly NodeDoc[], id: string): boolean =>
  nodes.some(
    (node) =>
      node.props.id === id ||
      Object.values(node.props).some((value) => holdsId(childrenIn(value), id)),
  );

/**
 * The type `adding`, put under `parentId` among `nodes`, would make a second of in a slot that
 * holds one at most, at any depth (its `once`: the Footer's one Menu links, 5.39), counting what
 * `adding` holds too; `undefined` if none. `moving` is the id of a node moved there, which doesn't
 * count where it was. React-free, so the AI apps' checks read it from the catalogue as data; the
 * editor's ways of adding read it from the library.
 */
export function secondOfOne(
  fieldsOf: OnceFields,
  nodes: readonly NodeDoc[],
  parentId: string,
  adding: NodeDoc,
  moving?: string,
): string | undefined {
  for (const node of nodes) {
    for (const [name, field] of Object.entries(fieldsOf(node.type) ?? {})) {
      if (field.kind !== "slot") continue;
      const children = childrenIn(node.props[name]);
      const under = node.props.id === parentId || holdsId(children, parentId);
      for (const type of under ? (field.once ?? []) : []) {
        if (countOfType(children, type, moving) + countOfType([adding], type) > 1) return type;
      }
      const deeper = secondOfOne(fieldsOf, children, parentId, adding, moving);
      if (deeper !== undefined) return deeper;
    }
  }
  return undefined;
}
