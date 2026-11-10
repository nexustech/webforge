import type { EngineEdit } from "@webforge/engine";
import { t } from "@webforge/i18n";
import {
  type Breakpoint,
  type CollectionField,
  collectionById,
  findNode,
  type NodeDoc,
  type PageDoc,
  type PageId,
  responsiveBoxOf,
  type SiteDoc,
} from "@webforge/model";
import type { ComponentDef, ComponentLibrary, FieldDef } from "@webforge/site-components";
import { updateField } from "./apply-patch.js";
import { deviceLabelFor, labelFor } from "./labels.js";
import {
  canvasLayout,
  designLabel,
  nodesAtHome,
  type SharedHome,
  type SharedRegion,
  sharedHomeOf,
  updateSharedField,
} from "./shared-layout.js";
import { type CopySelection, copySelection, updateSectionField } from "./shared-sections.js";

/**
 * The element selected on the canvas, and how to change its fields: the Edit panel (1.14) and the
 * canvas's handles (1.32) both change them through this, so a change goes to the same place and has
 * the same undo label whichever the user used.
 */
export type FieldTarget = {
  /** The page shown. */
  readonly page: PageDoc;
  readonly node: NodeDoc;
  readonly component: ComponentDef;
  /** The element's id as the canvas shows it: two copies show one element under two ids. */
  readonly id: string;
  /** Set for an element of the shared Header or Footer: its changes go to the site's layout. */
  readonly region: SharedRegion | undefined;
  /**
   * Set for an element of a collection's design, drawn around a post (6.10a): its changes go to
   * the collection, and its fields can show the post's.
   */
  readonly design: Exclude<SharedHome, SharedRegion> | undefined;
  /** In a Blog's design, the post's fields its elements can show (6.10a). */
  readonly itemFields: readonly CollectionField[] | undefined;
  /** Set for an element of a linked copy: its changes go to the shared section. */
  readonly inCopy: CopySelection | undefined;
  /** In a copy, every change is named as the canvas names it: "Edited shared section '…'". */
  readonly copyLabel: string | undefined;
  /**
   * A field's stored value; one never set (older sites, new fields) has the component's default.
   * A box is read in its current form, so a change writes it so (1.32).
   */
  storedOr(name: string, stored: unknown): unknown;
  /** An edit of the element, to name in undo labels: "Changed shared Footer size". */
  editOf(kind: EngineEdit["kind"], field: string): EngineEdit;
  /**
   * The undo label for a change to `name` on `breakpoint`; "… on Mobile" where it sets one
   * device's value, or with `reset` drops it.
   */
  labelOf(name: string, field: FieldDef, breakpoint: Breakpoint, reset?: boolean): string;
  /** Sets field `name` of the element to what `next` makes of it, in `draft`. */
  write(draft: SiteDoc, name: string, next: (stored: unknown) => unknown): void;
  /** Sets field `name` to what `next` makes of its stored value ({@link storedOr}). */
  recipe(name: string, next: (stored: unknown) => unknown): (draft: SiteDoc) => void;
};

/**
 * The element `nodeId` on page `pageId`: the page's own, one of the shared Header or Footer the
 * page shows (F-ED-7), or one of a linked copy on it (F-ED-23). Undefined if there is none, or the
 * library has no component for it.
 */
export function fieldTarget(
  site: SiteDoc,
  library: ComponentLibrary,
  pageId: PageId,
  nodeId: string | null,
): FieldTarget | undefined {
  const page = site.pages[pageId]?.doc;
  if (page === undefined || nodeId === null) {
    return undefined;
  }
  const isSelected = (candidate: NodeDoc) => candidate.props.id === nodeId;
  const ownNode = findNode(page.content, isSelected);
  const home = ownNode === undefined ? sharedHomeOf(site, pageId, nodeId) : undefined;
  const region = typeof home === "string" ? home : undefined;
  const design = typeof home === "object" ? home : undefined;
  const inCopy =
    ownNode === undefined && home === undefined ? copySelection(site, pageId, nodeId) : undefined;
  const node =
    home === undefined ? (ownNode ?? inCopy?.node) : findNode(nodesAtHome(site, home), isSelected);
  const component = node === undefined ? undefined : library.components[node.type];
  if (node === undefined || component === undefined) {
    return undefined;
  }
  const id = nodeId;

  // The theme's look for the element's kind (3.12, CT-1): what a field it doesn't set takes.
  const look = site.theme.looks?.[node.type] as Readonly<Record<string, unknown>> | undefined;
  const storedOr = (name: string, stored: unknown) => {
    const value = stored ?? look?.[name] ?? component.defaults[name];
    return component.fields[name]?.kind === "box" ? responsiveBoxOf(value) : value;
  };
  const editOf = (kind: EngineEdit["kind"], field: string): EngineEdit => ({
    kind,
    nodeId: id,
    componentType: node.type,
    field,
    page,
    selection: id,
    ...(home === undefined ? {} : { shared: true, layout: canvasLayout(site, pageId) }),
  });
  // In a copy or a Blog's design, every change is named by the shared section or the Blog.
  const copyLabel =
    inCopy !== undefined
      ? t("history.editedSharedSection", {
          name: t("history.namedItem", { name: inCopy.shared.name }),
        })
      : design === undefined
        ? undefined
        : designLabel(site, pageId, nodeId);
  const labelOf = (name: string, field: FieldDef, breakpoint: Breakpoint, reset = false) => {
    if (copyLabel !== undefined) return copyLabel;
    const edit = editOf(field.kind === "text" ? "text" : "props", name);
    return field.responsive === true && (reset || breakpoint !== "desktop")
      ? deviceLabelFor(edit, library, t(`device.${breakpoint}`), reset)
      : labelFor(edit, library);
  };
  const write = (draft: SiteDoc, name: string, next: (stored: unknown) => unknown) => {
    if (home !== undefined) {
      updateSharedField(draft, site, home, id, name, next);
      return;
    }
    if (inCopy !== undefined) {
      updateSectionField(draft, site, inCopy.shared.id, inCopy.node.props.id, name, next);
      return;
    }
    const target = draft.pages[pageId];
    if (target !== undefined) {
      updateField(target.doc, page, id, name, next);
    }
  };
  const recipe = (name: string, next: (stored: unknown) => unknown) => (draft: SiteDoc) =>
    write(draft, name, (stored) => next(storedOr(name, stored)));

  return {
    page,
    node,
    component,
    id,
    region,
    design,
    itemFields: design === undefined ? undefined : collectionById(site, design.collection)?.fields,
    inCopy,
    copyLabel,
    storedOr,
    editOf,
    labelOf,
    write,
    recipe,
  };
}
