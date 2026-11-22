import type { NodeDoc, SiteDoc } from "@webforge/model";
import type { CatalogueComponent } from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import { componentOf, confirmationFor, storedValues, values } from "./command-checks.js";
import { examplesInput, knownFacts, markWritten } from "./examples.js";
import type { Location } from "./locations.js";
import { type Failure, fail, failed, type Plan } from "./plan.js";

// A section's items given as it's added (#1249): a Features section's features, an FAQ's
// questions, a Table's rows, a Section's elements. One plan builds a page, and the section gets
// the app's items in place of its samples.

/**
 * How many levels one command builds: a Section, its Columns, a Column and the elements in it; or
 * a Section, its Table and the Table's rows.
 */
export const SLOT_DEPTH_MAX = 4;

/** The most sections, elements and items one command adds in all, however they nest. */
export const SLOT_NODES_MAX = 200;

/** The most items one slot takes in one command. */
export const SLOT_ITEMS_MAX = 50;

/** One item a slot's value gives: its type, its values (which may give its own slots' items) and its examples. */
const itemSchema = z.strictObject({
  type: z.string().min(1).max(64),
  values: values.default({}),
  examples: examplesInput,
});

/** A slot's items, as `addNode`'s values give them. */
const itemsSchema = z.array(itemSchema).max(SLOT_ITEMS_MAX);

/** A node built from what an app gave, with the confirmation each part of it needs. */
type Built = {
  readonly node: NodeDoc;
  /** Each part's confirmation, the node's first, then its items' in order. */
  readonly confirms: readonly Plan["confirm"][];
};

/** Whether `type` may go in `slot`, a slot field of `parent`, as `canGo` judges a placement. */
function allowedIn(parent: CatalogueComponent, slot: string, type: string): boolean {
  const field = parent.fields[slot];
  if (field?.kind !== "slot") return false;
  const component = componentOf(type);
  if (failed(component)) return false;
  return field.allow !== undefined
    ? field.allow.includes(type)
    : (field.accepts ?? "element") === component.place;
}

/**
 * A node of `component`'s type with `given` over its defaults, as `addNode` adds it: its own values
 * checked and stored as `storedValues` does, and each slot that `given` names filled with the items
 * it lists, built the same way, in place of the samples its defaults hold. Ids are the defaults'
 * until the caller gives the whole node new ones (`withNewIds`). `depth` is how deep it sits.
 */
export function builtNode(
  site: SiteDoc,
  location: Location,
  type: string,
  component: CatalogueComponent,
  given: Readonly<Record<string, unknown>>,
  examples: readonly string[] | undefined,
  depth = 0,
  count: { added: number } = { added: 0 },
): Built | Failure {
  count.added += 1;
  if (count.added > SLOT_NODES_MAX) {
    return fail("invalid", `One command adds ${SLOT_NODES_MAX} elements and items at most.`);
  }
  const isSlotField = (name: string) =>
    Object.hasOwn(component.fields, name) && component.fields[name]?.kind === "slot";
  const own = Object.fromEntries(Object.entries(given).filter(([name]) => !isSlotField(name)));
  const stored = storedValues(site, component, own);
  if (failed(stored)) return stored;
  const props: NodeDoc["props"] = {
    ...structuredClone(component.defaults),
    ...stored.values,
    id: "",
  };
  const confirms: Plan["confirm"][] = [
    confirmationFor(site, location, component, component.defaults, stored.values),
  ];
  for (const [slot, value] of Object.entries(given).filter(([name]) => isSlotField(name))) {
    if (depth + 1 >= SLOT_DEPTH_MAX) {
      return fail(
        "invalid",
        `${component.label}'s "${slot}" is too deep to fill here: add it, then add to it.`,
      );
    }
    const items = itemsSchema.safeParse(value);
    if (!items.success) {
      return fail(
        "invalid",
        `"${slot}" takes a list of items, each { type, values }: ${z.prettifyError(items.error)}`,
      );
    }
    const children: NodeDoc[] = [];
    for (const [at, item] of items.data.entries()) {
      if (!allowedIn(component, slot, item.type)) {
        const field = component.fields[slot];
        const takes = field?.kind === "slot" ? field.allow?.join(", ") : undefined;
        return fail(
          "invalid",
          `Item ${at + 1} of "${slot}": ${item.type} can't go in ${component.label}'s ${slot}.${takes === undefined ? "" : ` It takes ${takes}.`}`,
        );
      }
      const child = componentOf(item.type);
      if (failed(child)) return child;
      const built = builtNode(
        site,
        location,
        item.type,
        child,
        item.values,
        item.examples,
        depth + 1,
        count,
      );
      if (failed(built)) {
        return { ...built, message: `Item ${at + 1} of "${slot}": ${built.message}` };
      }
      children.push(built.node);
      confirms.push(...built.confirms);
    }
    // The app's items in place of the samples.
    props[slot] = children;
  }
  const node: NodeDoc = { type, props };
  // What it wrote that holds an example is marked as one (#1228, WN-3).
  markWritten(node, component.fields, stored.values, examples, knownFacts(site));
  return { node, confirms };
}

/**
 * The question adding a built node asks (D7, S18): a part's that changes where visitors' money or
 * details go, if any part does, which is always asked; else the node's own, as `addNode` asked.
 */
export function confirmationOf(confirms: readonly Plan["confirm"][]): Plan["confirm"] {
  const asked = confirms.find((confirm) => confirm?.("")?.first === true);
  return asked ?? confirms[0];
}
