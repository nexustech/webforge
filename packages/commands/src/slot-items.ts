import type { NodeDoc, SiteDoc } from "@webforge/model";
import type { CatalogueComponent } from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import { APP_PARSE } from "./app-errors.js";
import {
  canGo,
  componentOf,
  type DestinationChange,
  destinationChanges,
  destinationConfirmation,
  storedValues,
  values,
} from "./command-checks.js";
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

/** A node built from what an app gave, with what it changes about where visitors' money goes. */
type Built = {
  readonly node: NodeDoc;
  /** Each part's changes to where visitors' money or details go (S18), the node's first. */
  readonly changes: readonly DestinationChange[];
};

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
  const changes: DestinationChange[] = [
    ...destinationChanges(site, component, component.defaults, stored.values),
  ];
  for (const [slot, value] of Object.entries(given).filter(([name]) => isSlotField(name))) {
    if (depth + 1 >= SLOT_DEPTH_MAX) {
      return fail(
        "invalid",
        `${component.label}'s "${slot}" is too deep to fill here: add it, then add to it.`,
      );
    }
    const items = itemsSchema.safeParse(value, APP_PARSE);
    if (!items.success) {
      return fail(
        "invalid",
        `"${slot}" takes a list of items, each { type, values }: ${z.prettifyError(items.error)}`,
      );
    }
    const field = component.fields[slot];
    const most = field?.kind === "slot" ? field.max : undefined;
    if (most !== undefined && items.data.length > most) {
      return fail("invalid", `${component.label}'s "${slot}" takes ${most} at most.`);
    }
    const children: NodeDoc[] = [];
    // Placed as `addNode` places an element: in this slot, empty so far (its count checked above).
    const parent: NodeDoc = { type, props: { id: "", [slot]: [] } };
    for (const [at, item] of items.data.entries()) {
      // An unknown type, or one AI apps keep away from (Custom Code), says so (S19).
      const child = componentOf(item.type);
      if (failed(child))
        return { ...child, message: `Item ${at + 1} of "${slot}": ${child.message}` };
      const wrong = canGo(item.type, location, parent, slot);
      if (wrong !== undefined) {
        const takes = field?.kind === "slot" ? field.allow?.join(", ") : undefined;
        return fail(
          "invalid",
          `Item ${at + 1} of "${slot}": ${wrong}${takes === undefined ? "" : ` It takes ${takes}.`}`,
        );
      }
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
      changes.push(...built.changes);
    }
    // The app's items in place of the samples.
    props[slot] = children;
  }
  const node: NodeDoc = { type, props };
  // What it wrote that holds an example is marked as one (#1228, WN-3).
  markWritten(node, component.fields, stored.values, examples, knownFacts(site));
  return { node, changes };
}

/**
 * The question adding `built` at `location` asks (D7, S18): every change its parts make to where
 * visitors' money or details go, all in one question, which is always asked; else as adding an
 * element there asks.
 */
export function confirmationOf(site: SiteDoc, location: Location, built: Built): Plan["confirm"] {
  return destinationConfirmation(site, location, built.changes);
}
