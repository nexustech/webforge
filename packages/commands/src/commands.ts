import { t } from "@webforge/i18n";
import {
  insertPage,
  isNodeDoc,
  type NodeDoc,
  newId,
  type PageId,
  pageTitle,
  type SiteDoc,
  themeTokensSchema,
} from "@webforge/model";
import {
  CATALOGUE,
  type CatalogueComponent,
  type CatalogueField,
  fieldValueSchema,
} from "@webforge/site-components/catalogue-data";
import { z } from "zod";
import {
  holds,
  isSlot,
  type Location,
  locate,
  locationSchema,
  nodesAt,
  type Placed,
  pagesShowing,
} from "./locations.js";
import type { ChangeKind, Confirmation, Refusal } from "./types.js";

/** What a command will do: one undo step, and the confirmation it waits for, if any (D7). */
export type Plan = {
  /** The step's action, before the app's name: "Added Hero". */
  readonly action: string;
  /** Changes the page's structure: refused in Content mode (1.26). */
  readonly structural: boolean;
  /** What kind of change it is, as the editor's own are: a removal offers Undo in a toast (D4). */
  readonly kind: ChangeKind;
  /** Asked first, for a change to more than one page (D7); `{app}` is the app's name. */
  readonly confirm?: ((app: string) => Confirmation) | undefined;
  readonly recipe: (draft: SiteDoc) => void;
  /** What it makes: a new element's or page's id. */
  readonly id?: string;
};

/** Why a command can't be planned. */
export type Failure = { readonly status: Refusal; readonly message: string };

const fail = (status: Refusal, message: string): Failure => ({ status, message });

/** Whether a field is about what an element says (Content mode's), not how it looks. */
function isContent(field: CatalogueField): boolean {
  if (field.group !== undefined) return field.group === "content";
  return !["select", "toggle", "slider", "color", "spacing", "box"].includes(field.kind);
}

/** The component of `type`, or why there's none an AI app may use. */
function componentOf(type: string): CatalogueComponent | Failure {
  const component = CATALOGUE[type];
  if (component === undefined) return fail("invalid", `There is no component "${type}".`);
  if (
    component.advancedOnly === true ||
    Object.values(component.fields).some((f) => f.kind === "code")
  ) {
    return fail("refused", `AI apps can't add or edit ${component.label}.`);
  }
  return component;
}

/**
 * `values` checked against `component`'s fields: each a field it has, not a slot or Custom Code,
 * of the field's kind. A message says which is wrong.
 */
function checkedValues(
  component: CatalogueComponent,
  values: Readonly<Record<string, unknown>>,
): string | undefined {
  for (const [name, value] of Object.entries(values)) {
    const field = component.fields[name];
    if (field === undefined || field.kind === "slot" || field.kind === "code") {
      return `${component.label} has no field "${name}" an AI app can set.`;
    }
    const checked = fieldValueSchema(field).safeParse(value);
    if (!checked.success) {
      return `"${name}" isn't a valid ${field.kind}: ${z.prettifyError(checked.error)}`;
    }
  }
  return undefined;
}

/** `node` and everything in its slots, with new ids: a component's defaults keep theirs. */
function withNewIds(node: NodeDoc): NodeDoc {
  const props = Object.fromEntries(
    Object.entries(node.props).map(([name, value]) => [
      name,
      Array.isArray(value) && value.length > 0 && value.every(isNodeDoc)
        ? value.map(withNewIds)
        : value,
    ]),
  );
  return { type: node.type, props: { ...props, id: newId("node") } };
}

/** Whether a node of `type` can go in `slot` of `parent`, or at the top level of `location`. */
function canGo(
  type: string,
  location: Location,
  parent: NodeDoc | null,
  slot: string | null,
): string | undefined {
  const component = CATALOGUE[type];
  const place = component?.place ?? "element";
  if (parent === null || slot === null) {
    if (location.kind === "page" && place === "section") return undefined;
    return location.kind === "page"
      ? `Only sections go at the top of a page; put ${component?.label ?? type} in a section.`
      : "Elements go in a section's slot here, not at the top.";
  }
  const field = CATALOGUE[parent.type]?.fields[slot];
  if (field?.kind !== "slot") return `${parent.type} has no slot "${slot}".`;
  const allowed =
    field.allow !== undefined ? field.allow.includes(type) : (field.accepts ?? "element") === place;
  if (!allowed) return `${component?.label ?? type} can't go in ${parent.type}'s ${slot}.`;
  return undefined;
}

/** The node `nodeId` at `location` in `site`, or why it isn't there. */
function find(site: SiteDoc, location: Location, nodeId: string): Placed | Failure {
  const nodes = nodesAt(site, location);
  if (nodes === undefined) return fail("not-found", "That page or shared section isn't there.");
  return locate(nodes, nodeId) ?? fail("not-found", `There is no element "${nodeId}" there.`);
}

/** The confirmation a change at `location` needs, if it shows on more than one page (D7). */
function confirmationAt(site: SiteDoc, location: Location): Plan["confirm"] {
  const count = pagesShowing(site, location);
  if (location.kind === "page" || count <= 1) return undefined;
  const confirm = t("ai.confirm.allow");
  if (location.kind === "layout") {
    const part = t(`ai.part.${location.part}`);
    return (app) => ({
      action: t("ai.confirm.layout", { app, part }),
      confirm,
      affectedPages: count,
    });
  }
  const name = site.sharedSections[location.sharedSectionId as never]?.name ?? "";
  return (app) => ({
    action: t("ai.confirm.shared", { app, name }),
    confirm,
    affectedPages: count,
  });
}

/** Whether a planning step failed. */
const failed = (value: object): value is Failure => "status" in value;

const nodeId = z.string().min(1).max(200);
const values = z.record(z.string(), z.unknown());
const placement = {
  parentId: nodeId.nullable().default(null),
  slot: z.string().min(1).max(64).nullable().default(null),
  index: z.int().min(0).optional(),
};

/** The commands AI apps can run (F-AI-1): each takes its input and plans one undo step. */
export const COMMANDS = {
  /** Adds a section to a page, or an element to a slot, with `values` over its defaults. */
  addNode: {
    input: z.strictObject({
      location: locationSchema,
      type: z.string().min(1).max(64),
      values: values.default({}),
      ...placement,
    }),
    plan(
      site: SiteDoc,
      input: {
        location: Location;
        type: string;
        values: Record<string, unknown>;
        parentId: string | null;
        slot: string | null;
        index?: number | undefined;
      },
    ): Plan | Failure {
      const component = componentOf(input.type);
      if (failed(component)) return component;
      const invalid = checkedValues(component, input.values);
      if (invalid !== undefined) return fail("invalid", invalid);
      const nodes = nodesAt(site, input.location);
      if (nodes === undefined) return fail("not-found", "That page or shared section isn't there.");
      const parent = input.parentId === null ? null : locate(nodes, input.parentId)?.node;
      if (parent === undefined)
        return fail("not-found", `There is no element "${input.parentId}" there.`);
      const wrong = canGo(input.type, input.location, parent, input.slot);
      if (wrong !== undefined) return fail("refused", wrong);
      const node = withNewIds({
        type: input.type,
        props: { ...structuredClone(component.defaults), ...input.values, id: "" },
      });
      const { location, slot, index } = input;
      return {
        action: t("history.added", { item: component.label }),
        structural: true,
        kind: "insert",
        confirm: confirmationAt(site, location),
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
    input: z.strictObject({ location: locationSchema, nodeId, values }),
    plan(
      site: SiteDoc,
      input: { location: Location; nodeId: string; values: Record<string, unknown> },
    ): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      const component = componentOf(placed.node.type);
      if (failed(component)) return component;
      const invalid = checkedValues(component, input.values);
      if (invalid !== undefined) return fail("invalid", invalid);
      const names = Object.keys(input.values);
      if (names.length === 0) return fail("invalid", "Give at least one field to set.");
      const fields = names.map((name) => component.fields[name]).filter((f) => f !== undefined);
      const [only] = fields;
      const { location, nodeId: id } = input;
      return {
        action:
          fields.length === 1 && only !== undefined
            ? t("history.editedField", { item: component.label, field: only.label })
            : t("ai.history.fields", { item: component.label }),
        structural: fields.some((field) => !isContent(field)),
        kind: "props",
        confirm: confirmationAt(site, location),
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          const node = top === undefined ? undefined : locate(top, id)?.node;
          if (node !== undefined) Object.assign(node.props, structuredClone(input.values));
        },
      };
    },
  },
  /** Replaces an element's text, or rich text's HTML. */
  editText: {
    input: z.strictObject({
      location: locationSchema,
      nodeId,
      field: z.string().min(1).max(64),
      text: z.string().max(20_000),
    }),
    plan(
      site: SiteDoc,
      input: { location: Location; nodeId: string; field: string; text: string },
    ): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      const component = componentOf(placed.node.type);
      if (failed(component)) return component;
      const field = component.fields[input.field];
      if (field?.kind !== "text" && field?.kind !== "richtext") {
        return fail("invalid", `${component.label} has no text field "${input.field}".`);
      }
      const { location, nodeId: id } = input;
      return {
        action: t("history.editedText", { item: component.label }),
        structural: false,
        kind: "text",
        confirm: confirmationAt(site, location),
        recipe: (draft) => {
          const top = nodesAt(draft, location);
          const node = top === undefined ? undefined : locate(top, id)?.node;
          if (node !== undefined) node.props[input.field] = input.text;
        },
      };
    },
  },
  /** Moves an element: to another index, or into another section's slot at the same location. */
  moveNode: {
    input: z.strictObject({
      location: locationSchema,
      nodeId,
      ...placement,
      index: z.int().min(0),
    }),
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
      const wrong = canGo(placed.node.type, input.location, parent, input.slot);
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
    input: z.strictObject({ location: locationSchema, nodeId }),
    plan(site: SiteDoc, input: { location: Location; nodeId: string }): Plan | Failure {
      const placed = find(site, input.location, input.nodeId);
      if (failed(placed)) return placed;
      if (input.location.kind === "shared" && placed.parent === null) {
        return fail(
          "refused",
          "A shared section's own section can't be removed; remove its copies from pages.",
        );
      }
      if (placed.node.type === "Header" || placed.node.type === "Footer") {
        return fail("refused", "The Header and Footer can't be removed.");
      }
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
  /** Adds an empty page called `title`, before "Page not found", in the menu. */
  addPage: {
    input: z.strictObject({ title: z.string().min(1).max(200) }),
    plan(_site: SiteDoc, input: { title: string }): Plan | Failure {
      const title = pageTitle(input.title);
      if (title === "") return fail("invalid", "A page needs a title.");
      const id: PageId = newId("page");
      return {
        action: t("history.added", { item: t("pages.item", { name: title }) }),
        structural: true,
        kind: "insert",
        id,
        recipe: (draft) => insertPage(draft, id, title),
      };
    },
  },
  /** Sets theme tokens: colours, fonts, corners, spacing… Changes every page (D7). */
  setThemeTokens: {
    input: z.strictObject({ tokens: z.record(z.string(), z.unknown()) }),
    plan(site: SiteDoc, input: { tokens: Record<string, unknown> }): Plan | Failure {
      const theme = themeTokensSchema.safeParse({ ...site.theme, ...input.tokens });
      if (!theme.success) return fail("invalid", z.prettifyError(theme.error));
      const next = theme.data;
      return {
        action: t("ai.history.theme"),
        structural: true,
        kind: "props",
        confirm: (app) => ({
          action: t("ai.confirm.theme", { app }),
          confirm: t("ai.confirm.allow"),
          affectedPages: site.pageOrder.length,
        }),
        recipe: (draft) => {
          draft.theme = structuredClone(next);
        },
      };
    },
  },
} as const;

/** The name of a command. */
export type CommandName = keyof typeof COMMANDS;

/** The list in `slot` of the node `parentId` among `nodes`, made if it isn't there yet. */
function childrenOf(nodes: NodeDoc[], parentId: string, slot: string): NodeDoc[] | undefined {
  const parent = locate(nodes, parentId)?.node;
  if (parent === undefined) return undefined;
  const list = parent.props[slot];
  if (isSlot(list)) return list;
  const made: NodeDoc[] = [];
  parent.props[slot] = made;
  return made;
}
