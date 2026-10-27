import { sameValue } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import {
  isNodeDoc,
  isSharedCopy,
  type NodeDoc,
  type PageDoc,
  type PageId,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import type { ComponentDef } from "@webforge/site-components";
import { updateField } from "../editor/apply-patch.js";
import type { EditorSession } from "../editor/editor-session.js";
import { type FieldTarget, fieldTarget } from "../editor/field-target.js";
import { type SharedRegion, shownLayout, updateSharedField } from "../editor/shared-layout.js";
import { updateSectionField } from "../shared-sections/index.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { SiteWideConfirm } from "../shell/confirm-site-wide.js";

/** The option group every section and element has (2.22): its fields are the look. */
const APPEARANCE_GROUP_ID = "appearance";

/** How far *Apply look to every…* reaches (2.27, ST-4): the page shown, or the whole site. */
export type LookScope = "page" | "site";

/** What the look commands need of the editor session. */
export type LookSession = Pick<EditorSession, "history" | "ui" | "library" | "edit">;

/** The fields of `component`'s Appearance group (2.22, ST-1): the look it can pass on. */
export function lookFieldsOf(component: ComponentDef): string[] {
  return Object.entries(component.fields)
    .filter(([, field]) => field.optionGroup?.id === APPEARANCE_GROUP_ID)
    .map(([name]) => name);
}

/** Where an element is kept: a page's own content, the shared Header or Footer, a shared section. */
type Place =
  | { readonly kind: "page"; readonly pageId: PageId }
  | { readonly kind: "layout"; readonly region: SharedRegion }
  | { readonly kind: "shared"; readonly id: SharedSectionId };

/** An element of the kind, where it is kept, and the pages that show it. */
type LookTarget = {
  readonly place: Place;
  readonly node: NodeDoc;
  /** It, or a section or element it is in, is hidden in Layers (F-ED-12). */
  readonly hidden: boolean;
  readonly pages: readonly PageId[];
};

/** What applying a look would change: the elements, how many are hidden, the pages they're on. */
export type LookChange = {
  /** The component's name ("Button"), for the labels. */
  readonly item: string;
  /** Whether it is a section, so the labels say "sections" rather than "elements". */
  readonly section: boolean;
  /** The look, by field name, as the source element has it. */
  readonly values: Readonly<Record<string, unknown>>;
  /** The other elements of the kind whose look differs, each once (a shared section's once). */
  readonly targets: readonly LookTarget[];
  /** How many of them are hidden in Layers: they change too, and the confirmation says so. */
  readonly hidden: number;
  /** The pages that show a change, the one shown included. */
  readonly pages: readonly PageId[];
};

/** Every node of `type` in `nodes`, at any depth, with whether it or one it is in is hidden. */
function nodesOfType(
  nodes: readonly NodeDoc[],
  type: string,
  hiddenAbove = false,
): { readonly node: NodeDoc; readonly hidden: boolean }[] {
  return nodes.flatMap((node) => {
    const hidden = hiddenAbove || node.props.hidden === true;
    const inside = Object.values(node.props).flatMap((value) =>
      Array.isArray(value) ? nodesOfType(value.filter(isNodeDoc), type, hidden) : [],
    );
    return node.type === type ? [{ node, hidden }, ...inside] : inside;
  });
}

const REGIONS: readonly SharedRegion[] = ["header", "footer"];

/**
 * Every element of `type` that `scope` reaches from page `pageId`, each where it is kept: the
 * page's own (each page's, for the site); the shared Header and Footer where shown; and each shared
 * section with a copy there, once, whatever the number of copies (its copies follow it).
 */
function elementsOfType(
  site: SiteDoc,
  type: string,
  pageId: PageId,
  scope: LookScope,
): LookTarget[] {
  const pageIds = scope === "site" ? (Object.keys(site.pages) as PageId[]) : [pageId];
  const found: LookTarget[] = [];
  const sharedPages = new Map<SharedSectionId, PageId[]>();
  const layoutPages = new Map<SharedRegion, PageId[]>();
  for (const id of pageIds) {
    const page = site.pages[id];
    if (page === undefined) continue;
    for (const { node, hidden } of nodesOfType(
      page.doc.content.filter((node) => !isSharedCopy(node)),
      type,
    )) {
      found.push({ place: { kind: "page", pageId: id }, node, hidden, pages: [id] });
    }
    for (const copy of page.doc.content.filter(isSharedCopy)) {
      const pages = sharedPages.get(copy.props.sharedSectionId) ?? [];
      if (!pages.includes(id)) pages.push(id);
      sharedPages.set(copy.props.sharedSectionId, pages);
    }
    const shown = shownLayout(site, id);
    for (const region of REGIONS) {
      if (shown[region].length === 0) continue;
      const pages = layoutPages.get(region) ?? [];
      pages.push(id);
      layoutPages.set(region, pages);
    }
  }
  // What is shared is changed once, and on every page that shows it, not only those in scope.
  for (const region of REGIONS) {
    if (!layoutPages.has(region)) continue;
    const pages = (Object.keys(site.pages) as PageId[]).filter(
      (id) => shownLayout(site, id)[region].length > 0,
    );
    for (const { node, hidden } of nodesOfType(site.layout[region], type)) {
      found.push({ place: { kind: "layout", region }, node, hidden, pages });
    }
  }
  for (const id of sharedPages.keys()) {
    const shared = Object.hasOwn(site.sharedSections, id) ? site.sharedSections[id] : undefined;
    if (shared === undefined) continue;
    const pages = (Object.keys(site.pages) as PageId[]).filter((page) =>
      site.pages[page]?.doc.content.some(
        (node) => isSharedCopy(node) && node.props.sharedSectionId === id,
      ),
    );
    for (const { node, hidden } of nodesOfType([shared.section], type)) {
      found.push({ place: { kind: "shared", id }, node, hidden, pages });
    }
  }
  return found;
}

/** Where `target`, the selected element, is kept. */
function placeOf(target: FieldTarget, pageId: PageId): Place {
  if (target.region !== undefined) return { kind: "layout", region: target.region };
  if (target.inCopy !== undefined) return { kind: "shared", id: target.inCopy.shared.id };
  return { kind: "page", pageId };
}

const samePlace = (a: Place, b: Place) =>
  (a.kind === "page" && b.kind === "page" && a.pageId === b.pageId) ||
  (a.kind === "layout" && b.kind === "layout" && a.region === b.region) ||
  (a.kind === "shared" && b.kind === "shared" && a.id === b.id);

/** A field's value as stored, or the component's default where it was never set. */
const storedOr = (component: ComponentDef, node: NodeDoc, name: string) =>
  node.props[name] ?? component.defaults[name];

/**
 * What giving every other element of the selected one's kind its look would change, in `scope`
 * (2.27, ST-4): undefined when nothing with a look is selected. An element whose look is the same
 * already is left out, as is a field the element can't use with its own values (as Paste Style
 * leaves it, 1.37).
 */
export function lookChange(session: LookSession, scope: LookScope): LookChange | undefined {
  const site = session.history.document.getState();
  const { pageId, nodeId } = session.ui.getState();
  const source = fieldTarget(site, session.library, pageId, nodeId);
  if (source === undefined) return undefined;
  const names = lookFieldsOf(source.component);
  if (names.length === 0) return undefined;
  const { component } = source;
  const values = Object.fromEntries(
    names.map((name) => [name, storedOr(component, source.node, name)]),
  );
  const from = placeOf(source, pageId);
  const targets = elementsOfType(site, source.node.type, pageId, scope).filter(
    ({ place, node }) =>
      !(samePlace(place, from) && node.props.id === source.node.props.id) &&
      changedFields(component, node, values).length > 0,
  );
  return {
    item: component.label,
    section: component.place === "section",
    values,
    targets,
    hidden: targets.filter((target) => target.hidden).length,
    pages: [...new Set(targets.flatMap((target) => target.pages))],
  };
}

/** The fields of `values` that `node` has otherwise, and can take with its own values. */
function changedFields(
  component: ComponentDef,
  node: NodeDoc,
  values: Readonly<Record<string, unknown>>,
): string[] {
  const own = { ...component.defaults, ...node.props };
  return Object.entries(values)
    .filter(
      ([name, value]) =>
        component.fields[name]?.unavailable?.(own) === undefined &&
        !sameValue(storedOr(component, node, name), value),
    )
    .map(([name]) => name);
}

/** The undo label: "Applied the Button look to 12 others". */
function appliedLookLabel(change: LookChange): string {
  return plural("history.appliedLook", change.targets.length, { item: change.item });
}

/**
 * Gives every element of `change` its look, as one undo step (D2): a shared section's elements
 * once, which every copy shows. Nothing is recorded when there is nothing to change.
 */
export function applyLook(session: LookSession, change: LookChange): boolean {
  if (change.targets.length === 0) return false;
  const site = session.history.document.getState();
  const component = session.library.components[change.targets[0]?.node.type ?? ""];
  if (component === undefined) return false;
  session.edit("props", appliedLookLabel(change), (draft) => {
    for (const { place, node } of change.targets) {
      for (const name of changedFields(component, node, change.values)) {
        const next = () => structuredClone(change.values[name]);
        const id = node.props.id;
        if (place.kind === "layout") {
          updateSharedField(draft.layout, site.layout, place.region, id, name, next);
        } else if (place.kind === "shared") {
          updateSectionField(draft, site, place.id, id, name, next);
        } else {
          const page: PageDoc | undefined = site.pages[place.pageId]?.doc;
          const into = draft.pages[place.pageId];
          if (page !== undefined && into !== undefined) updateField(into.doc, page, id, name, next);
        }
      }
    }
  });
  return true;
}

/** The confirmation's text for `change`: how many elements change, and how many are hidden. */
export function lookConfirmation(change: LookChange, scope: LookScope) {
  const changes = plural(
    change.section ? "look.confirm.sections" : "look.confirm.elements",
    change.targets.length,
    { item: change.item },
  );
  const hidden = change.hidden === 0 ? "" : ` ${plural("look.confirm.hidden", change.hidden)}`;
  return {
    action: t(`look.confirm.title.${scope}`, { item: change.item }),
    description: `${changes}${hidden}`,
    confirm: t("look.confirm.apply"),
    affectedPages: change.pages.length,
  };
}

/** The commands' ids, for the Edit menu, the element menu and the Appearance group's menu. */
export const LOOK_COMMANDS = {
  page: "edit.applyLookOnPage",
  site: "edit.applyLookOnSite",
} as const;

/**
 * Gives every other element of the selected one's kind its look, in `scope` (2.27, ST-4). A change
 * that reaches a page other than the one shown asks first, saying how many elements change (D7);
 * one on this page alone happens at once. Either way it is one undo step. When every one has the
 * look already, `notify` says so. Resolves whether anything changed.
 */
export function applyLookToAll(
  session: LookSession,
  scope: LookScope,
  siteWide: Pick<SiteWideConfirm, "confirmSiteWide"> | undefined,
  notify?: (message: string) => void,
): Promise<boolean> {
  const change = lookChange(session, scope);
  if (change === undefined) return Promise.resolve(false);
  if (change.targets.length === 0) {
    notify?.(t(`look.same.${scope}`, { item: change.item }));
    return Promise.resolve(false);
  }
  const { pageId } = session.ui.getState();
  const elsewhere = change.pages.some((page) => page !== pageId);
  if (!elsewhere || siteWide === undefined) return Promise.resolve(applyLook(session, change));
  const asked = session.history.document.getState();
  return siteWide.confirmSiteWide(lookConfirmation(change, scope)).then((confirmed) => {
    // Only on the site it asked about; commands are paused while it asks.
    if (!confirmed || session.history.document.getState() !== asked) return false;
    return applyLook(session, change);
  });
}

/**
 * Registers *Apply Look to Every ‹kind› on This Page* and *… on the Site* (2.27, ST-4) in the Edit
 * menu and the command box, named for the selected element's kind. Off with nothing selected that
 * has a look, and in Content mode (M3), which has no Style tab. Returns a function that removes
 * them, and one that follows Content mode's lock.
 */
export function registerLookCommands(
  registry: CommandRegistry,
  session: LookSession,
  beforeAction: () => void,
  siteWide: Pick<SiteWideConfirm, "confirmSiteWide"> | undefined,
  notify?: (message: string) => void,
): { readonly remove: () => void; readonly setLayoutLocked: (locked: boolean) => void } {
  let locked = false;
  // What the commands were last set for: found again only when the document, the page, the
  // selection or the lock has changed, not on every keystroke's change.
  let last: { site: unknown; pageId: unknown; nodeId: unknown; locked: boolean } | undefined;
  const update = () => {
    const site = session.history.document.getState();
    const { pageId, nodeId } = session.ui.getState();
    if (
      last?.site === site &&
      last.pageId === pageId &&
      last.nodeId === nodeId &&
      last.locked === locked
    ) {
      return;
    }
    last = { site, pageId, nodeId, locked };
    const target = fieldTarget(site, session.library, pageId, nodeId);
    // Named for a kind with a look only: the Header and Footer have none.
    const item =
      target !== undefined && lookFieldsOf(target.component).length > 0
        ? target.component.label
        : undefined;
    for (const scope of ["page", "site"] as const) {
      registry.update(LOOK_COMMANDS[scope], {
        enabled: !locked && item !== undefined,
        label:
          item === undefined
            ? t(`edit.applyLook.${scope}.any`)
            : t(`edit.applyLook.${scope}`, { item }),
      });
    }
  };
  const removers = [
    ...(["page", "site"] as const).map((scope) =>
      registry.register({
        id: LOOK_COMMANDS[scope],
        label: t(`edit.applyLook.${scope}.any`),
        menu: "edit",
        enabled: false,
        run: () => {
          if (locked) return;
          beforeAction();
          void applyLookToAll(session, scope, siteWide, notify);
        },
      }),
    ),
    session.ui.subscribe(update),
    session.history.document.subscribe(update),
  ];
  update();
  return {
    remove: () => {
      for (const remove of removers) remove();
    },
    setLayoutLocked: (next) => {
      locked = next;
      update();
    },
  };
}
