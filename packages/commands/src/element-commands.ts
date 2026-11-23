import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import { usableComponents } from "./catalogue.js";
import {
  canGo,
  childrenOf,
  componentOf,
  confirmationAt,
  confirmationFor,
  find,
  isContent,
  nodeId,
  placement,
  storedValues,
  untouchable,
  values,
  withNewIds,
} from "./command-checks.js";
import { EXAMPLES_FIELD, examplesInput, knownFacts, markWritten } from "./examples.js";
import { holds, type Location, locate, locationSchema, nodesAt } from "./locations.js";
import { type Failure, fail, failed, type Plan, type PlanSummary } from "./plan.js";
import {
  builtNode,
  confirmationOf,
  SLOT_DEPTH_MAX,
  SLOT_ITEMS_MAX,
  SLOT_NODES_MAX,
} from "./slot-items.js";

/** The commands that add, change, move and remove sections and elements (F-AI-1). */
export const ELEMENT_COMMANDS = {
  /** Adds a section to a page, or an element to a slot, with `values` over its defaults. */
  addNode: {
    description: `Adds a section to a page (parentId null) or an element to a section's slot, of a type from the catalogue, with values over its defaults. Its slots' items may be given in values too, so one plan builds a page: a slot's name (a Features section's items, an FAQ's items, a Table's rows, a Section's content) with a list of { type, values, examples }, the types its slot takes, each item's values giving its own slots' items in turn, up to ${SLOT_DEPTH_MAX} levels, ${SLOT_ITEMS_MAX} items a slot and ${SLOT_NODES_MAX} in all. Those items replace the section's sample ones; a slot not given keeps its samples. Answers with the new element's id. One undo step. ${EXAMPLES_FIELD}`,
    input: z.strictObject({
      location: locationSchema,
      type: z.string().min(1).max(64),
      values: values.default({}),
      examples: examplesInput,
      ...placement,
    }),
    summarize(summary: PlanSummary) {
      summary.elements.added += 1;
    },
    plan(
      site: SiteDoc,
      input: {
        location: Location;
        type: string;
        values: Record<string, unknown>;
        examples?: string[] | undefined;
        parentId: string | null;
        slot: string | null;
        index?: number | undefined;
      },
    ): Plan | Failure {
      const nodes = nodesAt(site, input.location);
      if (nodes === undefined) return fail("not-found", "That page or shared section isn't there.");
      const parent = input.parentId === null ? null : locate(nodes, input.parentId)?.node;
      if (parent === undefined)
        return fail("not-found", `There is no element "${input.parentId}" there.`);
      const component = componentOf(input.type, () =>
        usableComponents()
          .map(([type]) => type)
          .filter((type) => canGo(type, input.location, parent, input.slot) === undefined),
      );
      if (failed(component)) return component;
      // Its values, and the items of each slot they name in place of its samples (#1249).
      const built = builtNode(
        site,
        input.location,
        input.type,
        component,
        input.values,
        input.examples,
      );
      if (failed(built)) return built;
      const wrong = canGo(input.type, input.location, parent, input.slot, undefined, {
        nodes,
        node: built.node,
      });
      if (wrong !== undefined) return fail("refused", wrong);
      const node = withNewIds(built.node);
      const { location, slot, index } = input;
      return {
        action: t("history.added", { item: component.label }),
        structural: true,
        kind: "insert",
        confirm: confirmationOf(site, input.location, built),
        id: node.props.id,
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          if (top === undefined) return;
          const into =
            parent === null || slot === null ? top : childrenOf(top, parent.props.id, slot);
          if (into === undefined) return;
          into.splice(index ?? into.length, 0, node);
        },
      };
    },
  },
  /** Sets fields of an element: its title, a select's option, an image, a link… */
  updateFields: {
    description: `Sets fields of an element, by the names and value schemas fields gives. One undo step. A change to the shared Header, Footer or a shared section, or to where visitors' payments or details go, waits for the person to allow it. ${EXAMPLES_FIELD}`,
    input: z.strictObject({ location: locationSchema, nodeId, values, examples: examplesInput }),
    summarize(summary: PlanSummary) {
      summary.elements.changed += 1;
    },
    plan(
      site: SiteDoc,
      input: {
        location: Location;
        nodeId: string;
        values: Record<string, unknown>;
        examples?: string[] | undefined;
      },
    ): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      const component = componentOf(placed.node.type);
      if (failed(component)) return component;
      const stored = storedValues(site, component, input.values);
      if (failed(stored)) return stored;
      const { values } = stored;
      const names = Object.keys(values);
      if (names.length === 0) return fail("invalid", "Give at least one field to set.");
      const fields = names.map((name) => component.fields[name]).filter((f) => f !== undefined);
      const [only] = fields;
      const { location, nodeId: id } = input;
      // The facts the site gives as it is, to tell what the text made up (#1228).
      const known = knownFacts(site);
      return {
        action:
          fields.length === 1 && only !== undefined
            ? t("history.editedField", { item: component.label, field: only.label })
            : t("ai.history.fields", { item: component.label }),
        structural: fields.some((field) => !isContent(field)),
        kind: "props",
        confirm: confirmationFor(site, location, component, placed.node.props, values),
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          const node = top === undefined ? undefined : locate(top, id)?.node;
          if (node === undefined) return;
          Object.assign(node.props, structuredClone(values));
          markWritten(node, component.fields, values, input.examples, known);
        },
      };
    },
  },
  /** Replaces an element's text, or rich text's HTML. */
  editText: {
    description:
      "Replaces an element's text, or a rich-text field's HTML (cleaned). One undo step. Set example to true if the new text holds an example for a fact you weren't given.",
    input: z.strictObject({
      location: locationSchema,
      nodeId,
      field: z.string().min(1).max(64),
      text: z.string().max(20_000),
      example: z.boolean().optional(),
    }),
    summarize(summary: PlanSummary) {
      summary.elements.changed += 1;
    },
    plan(
      site: SiteDoc,
      input: {
        location: Location;
        nodeId: string;
        field: string;
        text: string;
        example?: boolean | undefined;
      },
    ): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      const component = componentOf(placed.node.type);
      if (failed(component)) return component;
      const field = component.fields[input.field];
      if (field?.kind !== "text" && field?.kind !== "richtext") {
        return fail("invalid", `${component.label} has no text field "${input.field}".`);
      }
      // As updateFields sets it: the field's own schema, rich text cleaned, its links checked.
      const stored = storedValues(site, component, { [input.field]: input.text });
      if (failed(stored)) return stored;
      const text = stored.values[input.field];
      const { location, nodeId: id } = input;
      // The facts the site gives as it is, to tell what the text made up (#1228).
      const known = knownFacts(site);
      return {
        action: t("history.editedText", { item: component.label }),
        structural: false,
        kind: "text",
        confirm: confirmationFor(site, location, component, placed.node.props, {
          [input.field]: text,
        }),
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          const node = top === undefined ? undefined : locate(top, id)?.node;
          if (node === undefined) return;
          node.props[input.field] = text;
          markWritten(
            node,
            component.fields,
            { [input.field]: text },
            input.example === true ? [input.field] : [],
            known,
          );
        },
      };
    },
  },
  /** Moves an element: to another index, or into another section's slot at the same location. */
  moveNode: {
    description:
      "Moves an element to another index, or into another section's slot at the same location. One undo step.",
    input: z.strictObject({
      location: locationSchema,
      nodeId,
      ...placement,
      index: z.int().min(0),
    }),
    summarize(summary: PlanSummary) {
      summary.elements.moved += 1;
    },
    plan(
      site: SiteDoc,
      input: {
        location: Location;
        nodeId: string;
        parentId: string | null;
        slot: string | null;
        index: number;
      },
    ): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      const kept = untouchable(placed.node);
      if (kept !== undefined) return kept;
      const nodes = nodesAt(site, input.location) ?? [];
      const parent = input.parentId === null ? null : locate(nodes, input.parentId)?.node;
      if (parent === undefined)
        return fail("not-found", `There is no element "${input.parentId}" there.`);
      if (
        parent !== null &&
        (parent.props.id === input.nodeId || holds(placed.node, parent.props.id))
      ) {
        return fail("refused", "An element can't go inside itself.");
      }
      const wrong = canGo(placed.node.type, input.location, parent, input.slot, input.nodeId, {
        nodes,
        node: placed.node,
      });
      if (wrong !== undefined) return fail("refused", wrong);
      const { location, nodeId: id, slot, index } = input;
      const label = CATALOGUE[placed.node.type]?.label ?? placed.node.type;
      return {
        action: t("history.moved", { item: label }),
        structural: true,
        kind: "move",
        confirm: confirmationAt(site, location),
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          const from = top === undefined ? undefined : locate(top, id);
          if (top === undefined || from === undefined) return;
          const [node] = from.list.splice(from.index, 1);
          const into =
            parent === null || slot === null ? top : childrenOf(top, parent.props.id, slot);
          if (node !== undefined && into !== undefined)
            into.splice(Math.min(index, into.length), 0, node);
        },
      };
    },
  },
  /** Removes an element, or a linked copy of a shared section from a page. */
  removeNode: {
    description:
      "Removes an element, or a linked copy of a shared section from a page. One undo step, which the person can undo.",
    input: z.strictObject({ location: locationSchema, nodeId }),
    summarize(summary: PlanSummary) {
      summary.elements.removed += 1;
    },
    plan(site: SiteDoc, input: { location: Location; nodeId: string }): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      if (input.location.kind === "shared" && placed.parent === null) {
        return fail(
          "refused",
          "A shared section's own section can't be removed; remove its copies from pages.",
        );
      }
      // The site's Header and Footer: the catalogue's layout components (#982).
      if (CATALOGUE[placed.node.type]?.place === "layout") {
        return fail("refused", "The Header and Footer can't be removed.");
      }
      const kept = untouchable(placed.node);
      if (kept !== undefined) return kept;
      const { location, nodeId: id } = input;
      const label = CATALOGUE[placed.node.type]?.label ?? placed.node.type;
      return {
        action: t("history.deleted", { item: label }),
        structural: true,
        kind: "remove",
        confirm: confirmationAt(site, location),
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          const from = top === undefined ? undefined : locate(top, id);
          from?.list.splice(from.index, 1);
        },
      };
    },
  },
} as const;
