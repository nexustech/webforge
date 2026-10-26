import type { ListChange } from "@webforge/editor-ui";
import type { EngineEdit } from "@webforge/engine";
import {
  type BoxValue,
  COLOR_ROLES,
  copiedNodeId,
  isSharedCopy,
  type MenuItemId,
  type NodeDoc,
  type PageDoc,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
  TEXT_SIZES,
  TEXT_STYLES,
  themeIdSchema,
} from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import { createFakeEngine, type FakeEngine } from "@webforge/test-utils/renderer";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import {
  deleteSelected,
  duplicateSelected,
  moveSelected,
  similarTo,
  toggleSelectedHidden,
} from "../layers/index.js";
import {
  addMenuItem,
  editMenuLink,
  followPages,
  moveMenuItem,
  removeMenuItem,
  renameMenuItem,
  setMenuItemHidden,
} from "../menu/index.js";
import {
  deleteSharedSection,
  detachCopy,
  renameSharedSection,
  saveAsSharedSection,
  updateSectionField,
} from "../shared-sections/index.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  connectEngine,
  type EditorSession,
  type EngineConnection,
  runHistoryCommand,
  TEXT_SESSION_GRACE_MS,
} from "./editor-session.js";
import { copyLayer } from "./layers.js";
import { applyListChange, editableList, listItems } from "./list-edit.js";
import { withoutOverride, withValueAt } from "./responsive-value.js";

// Undo invariant (U8) over the editor as wired: canvas edits of every kind on any page, page
// switches, site settings, the shared layout and the menu editor, interleaved with undo, redo and
// jumps. Undo all
// returns exactly to the opened site and redo all to the final one, and the canvas always shows
// the document's current page.

type Ctx = {
  readonly session: EditorSession;
  readonly engine: FakeEngine;
  readonly connection: EngineConnection;
  readonly pages: readonly PageId[];
  /** The page the canvas shows: the last one loaded or applied. */
  shown(): PageDoc | undefined;
};

const ABOUT = "page-about" as PageId;
const HOURS = "shared-hours" as SharedSectionId;

function initialSite(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  // A FAQ, whose questions the Edit panel edits as a list (F-ED-6).
  home.doc.content.push({
    type: "Faq",
    props: {
      id: "faq",
      title: "Questions",
      items: [
        { type: "FaqItem", props: { id: "q1", question: "One?", answer: "<p>1</p>" } },
        { type: "FaqItem", props: { id: "q2", question: "Two?", answer: "<p>2</p>" } },
      ],
    },
  });
  // A linked copy of a shared section (F-ED-23), which the canvas edits through.
  home.doc.content.push({
    type: SHARED_COPY_TYPE,
    props: { id: "hours-copy", sharedSectionId: HOURS },
  });
  return {
    ...site,
    pages: {
      ...site.pages,
      [ABOUT]: { ...home, id: ABOUT, slug: "about", title: "About", doc: starterPage() },
    },
    pageOrder: [...site.pageOrder, ABOUT],
    sharedSections: {
      [HOURS]: {
        id: HOURS,
        name: "Opening hours",
        section: { type: "Heading", props: { id: "hours", text: "Hours" } },
      },
    },
  };
}

function setup(): Ctx {
  const site = initialSite();
  const session = sessionWith(site);
  const engine = createFakeEngine();
  let shown: PageDoc | undefined = site.pages[site.homePageId]?.doc;
  vi.mocked(engine.loadPage).mockImplementation((page) => {
    shown = page;
  });
  vi.mocked(engine.applyChange).mockImplementation(({ page }) => {
    shown = page;
  });
  const connection = connectEngine(engine, session);
  return { session, engine, connection, pages: site.pageOrder, shown: () => shown };
}

/** Every list of nodes in a page: the top level and each node's slots. */
function lists(page: PageDoc): NodeDoc[][] {
  const all: NodeDoc[][] = [page.content];
  const visit = (nodes: readonly NodeDoc[]) => {
    for (const node of nodes) {
      for (const value of Object.values(node.props)) {
        if (Array.isArray(value)) {
          all.push(value as NodeDoc[]);
          visit(value as NodeDoc[]);
        }
      }
    }
  };
  visit(page.content);
  return all;
}

const nodesOf = (page: PageDoc) => lists(page).flat();

/** Reports a canvas edit the way the engine does: the whole page after it, maybe a patch. */
function canvasEdit(
  ctx: Ctx,
  kind: EngineEdit["kind"],
  change: (page: PageDoc) => NodeDoc | undefined,
  patch?: (node: NodeDoc) => EngineEdit["patch"],
) {
  const { session, engine } = ctx;
  const current = session.history.document.getState().pages[session.ui.getState().pageId]?.doc;
  if (current === undefined) return;
  const page = structuredClone(current);
  const node = change(page);
  const edit: Partial<EngineEdit> & Pick<EngineEdit, "kind" | "page"> = {
    kind,
    page,
    nodeId: node?.props.id ?? null,
    componentType: node?.type ?? null,
    selection: node?.props.id ?? null,
  };
  const p = node === undefined ? undefined : patch?.(node);
  engine.edit(p === undefined ? edit : { ...edit, field: p.field, patch: p });
}

type Command = { readonly name: string; run(ctx: Ctx): void };

const n = fc.nat({ max: 20 });
const devices = fc.constantFrom("desktop" as const, "tablet" as const, "mobile" as const);

/** Changes a Section's field on the page shown, as the Edit panel does (1.14). */
function sectionEdit(ctx: Ctx, at: number, field: string, next: (stored: unknown) => unknown) {
  const { pageId } = ctx.session.ui.getState();
  ctx.session.edit("props", `Changed Section ${field}`, (draft) => {
    const page = draft.pages[pageId]?.doc;
    const section =
      page === undefined ? undefined : nodesOf(page).filter((x) => x.type === "Section")[at % 3];
    if (section !== undefined) section.props[field] = next(section.props[field]);
  });
}
let ids = 0;

const faqList = (() => {
  const items = siteLibrary.components.Faq?.fields.items;
  const list = items === undefined ? undefined : editableList(items, siteLibrary);
  if (list === undefined) throw new Error("no FAQ list");
  return list;
})();

/** Changes the questions of the shown page's first FAQ, as the Edit panel's list does. */
function faqEdit(ctx: Ctx, change: (ids: readonly string[]) => ListChange) {
  const { pageId } = ctx.session.ui.getState();
  ctx.session.edit("props", "Changed FAQ questions", (draft) => {
    const page = draft.pages[pageId]?.doc;
    const faq = page === undefined ? undefined : nodesOf(page).find((x) => x.type === "Faq");
    const items = faq?.props.items;
    if (Array.isArray(items)) {
      applyListChange(items, change(listItems(items, faqList).map((item) => item.id)), faqList);
    }
  });
}

/** The menu's items, dropdowns' contents included, in menu order. */
function menuItemIds(ctx: Ctx): MenuItemId[] {
  return ctx.session.history.document
    .getState()
    .menu.items.flatMap((item) => [
      item.id,
      ...(item.kind === "group" ? item.children.map((child) => child.id) : []),
    ]);
}

/** Item `at` of the menu (counting around), if it has any. */
const menuItemAt = (ctx: Ctx, at: number) => {
  const ids = menuItemIds(ctx);
  return ids[at % Math.max(ids.length, 1)];
};

/** The menu editor's changes (F-ED-17), as its panel makes them. */
const menuCommands: fc.Arbitrary<Command>[] = [
  fc.constantFrom("link", "button", "section", "group").map((kind) => ({
    name: `add menu ${kind}`,
    run: (ctx) => {
      if (kind === "group") {
        addMenuItem(ctx.session, { kind, label: "More" });
      } else if (kind === "section") {
        // A section linked to for the first time: it gets its anchor in the same step.
        const anchorId = `menu-${ids++}`;
        addMenuItem(ctx.session, {
          kind: "link",
          label: "Hours",
          change: {
            link: { kind: "page", pageId: ABOUT, anchor: anchorId },
            anchor: { pageId: ABOUT, nodeId: "section-1", anchorId },
          },
        });
      } else {
        addMenuItem(ctx.session, {
          kind,
          label: "Book",
          change: { link: { kind: "url", href: "https://book.example" } },
        });
      }
    },
  })),
  fc.record({ at: n, into: n, index: n }).map(({ at, into, index }) => ({
    name: `move menu item ${at} to ${into}:${index}`,
    run: (ctx) => {
      const id = menuItemAt(ctx, at);
      const groups = ctx.session.history.document
        .getState()
        .menu.items.filter((item) => item.kind === "group");
      // Into a dropdown, or (one in three) the menu itself.
      const group = into % 3 === 0 ? null : (groups[into % Math.max(groups.length, 1)]?.id ?? null);
      if (id !== undefined) moveMenuItem(ctx.session, id, { group, index });
    },
  })),
  n.map((at) => ({
    name: `remove menu item ${at}`,
    run: (ctx) => {
      const id = menuItemAt(ctx, at);
      if (id !== undefined) removeMenuItem(ctx.session, id);
    },
  })),
  fc.record({ at: n, label: fc.string({ maxLength: 4 }) }).map(({ at, label }) => ({
    name: `rename menu item ${at} "${label}"`,
    run: (ctx) => {
      const id = menuItemAt(ctx, at);
      if (id !== undefined) renameMenuItem(ctx.session, id, label);
    },
  })),
  fc.record({ at: n, hidden: fc.boolean() }).map(({ at, hidden }) => ({
    name: `${hidden ? "hide" : "show"} menu item ${at}`,
    run: (ctx) => {
      const id = menuItemAt(ctx, at);
      if (id !== undefined) setMenuItemHidden(ctx.session, id, hidden);
    },
  })),
  n.map((at) => ({
    name: `relink menu item ${at}`,
    run: (ctx) => {
      const id = menuItemAt(ctx, at);
      if (id !== undefined) {
        editMenuLink(ctx.session, id, "Shop", {
          link: { kind: "url", href: "https://shop.example" },
        });
      }
    },
  })),
  fc.constant<Command>({ name: "follow the page order", run: (ctx) => followPages(ctx.session) }),
];

/** One of the person's own themes' id, for the edits that save or rename it (2.23). */
const OWN_THEME_ID = themeIdSchema.parse("theme0000000000a");

/**
 * Theme edits (2.1): a colour role, the type scale or the shadow changed site-wide, each one step,
 * as the Theme panel (2.3) will make them.
 */
const themeCommands: fc.Arbitrary<Command>[] = [
  fc
    .record({
      role: fc.constantFrom(...COLOR_ROLES),
      l: fc.double({ min: 0, max: 1, noNaN: true }),
      h: fc.double({ min: 0, max: 360, noNaN: true }),
    })
    .map(({ role, l, h }) => ({
      name: `theme colour ${role} ${l} ${h}`,
      run: (ctx) =>
        ctx.session.edit("root", "Changed theme colours", (draft) => {
          draft.theme.colors[role] = { l, c: 0.1, h };
        }),
    })),
  fc
    .record({ style: fc.constantFrom(...TEXT_STYLES), size: fc.constantFrom(...TEXT_SIZES) })
    .map(({ style, size }) => ({
      name: `theme text ${style} ${size}`,
      run: (ctx) =>
        ctx.session.edit("root", "Changed theme text styles", (draft) => {
          draft.theme.typeScale[style].size = size;
        }),
    })),
  fc.constantFrom("none", "soft", "strong").map((shadow) => ({
    name: `theme shadow ${shadow}`,
    run: (ctx) =>
      ctx.session.edit("root", "Changed theme shadows", (draft) => {
        draft.theme = { ...draft.theme, shadow };
      }),
  })),
  // The person's own themes (2.23): a built-in theme saved under a name with its first change, a
  // rename, and back to a built-in one.
  fc
    .record({
      name: fc.constantFrom("Bakery", "Light (my version)", "Shop"),
      l: fc.double({ min: 0, max: 1, noNaN: true }),
    })
    .map(({ name, l }) => ({
      name: `own theme ${name} ${l}`,
      run: (ctx) =>
        ctx.session.edit("root", `Saved theme '${name}'`, (draft) => {
          draft.theme.colors.primary = { l, c: 0.1, h: 30 };
          draft.theme.own = { id: OWN_THEME_ID, name };
        }),
    })),
  fc.constant<Command>({
    name: "built-in theme",
    run: (ctx) =>
      ctx.session.edit("root", "Changed theme to 'Light'", (draft) => {
        delete draft.theme.own;
      }),
  }),
];

const commands: fc.Arbitrary<Command>[] = [
  ...menuCommands,
  ...themeCommands,
  fc.record({ at: n, to: n }).map(({ at, to }) => ({
    name: `insert ${at} ${to}`,
    run: (ctx) =>
      canvasEdit(ctx, "insert", (page) => {
        const list = lists(page)[at % lists(page).length] ?? page.content;
        const node: NodeDoc = { type: "Heading", props: { id: `new-${ids++}`, text: "New" } };
        list.splice(to % (list.length + 1), 0, node);
        return node;
      }),
  })),
  fc.record({ at: n, from: n }).map(({ at, from }) => ({
    name: `remove ${at} ${from}`,
    run: (ctx) =>
      canvasEdit(ctx, "remove", (page) => {
        const list = lists(page).filter((l) => l.length > 0)[at % 8];
        return list?.splice(from % list.length, 1)[0];
      }),
  })),
  fc.record({ at: n, from: n, to: n }).map(({ at, from, to }) => ({
    name: `move ${at} ${from} ${to}`,
    run: (ctx) =>
      canvasEdit(ctx, "move", (page) => {
        const source = lists(page).filter((l) => l.length > 0)[at % 8];
        const [node] = source?.splice(from % source.length, 1) ?? [];
        if (node === undefined) return undefined;
        // The node is out of the page now, so it can't be moved into itself.
        const target = lists(page)[to % lists(page).length] ?? page.content;
        target.splice(to % (target.length + 1), 0, node);
        return node;
      }),
  })),
  fc.record({ at: n }).map(({ at }) => ({
    name: `duplicate ${at}`,
    run: (ctx) =>
      canvasEdit(ctx, "duplicate", (page) => {
        const list = lists(page).find((l) => l.length > 0);
        const original = list?.[at % (list?.length ?? 1)];
        if (list === undefined || original === undefined) return undefined;
        const copy = structuredClone(original);
        for (const node of nodesOf({ root: { props: {} }, content: [copy] })) {
          node.props.id = `copy-${ids++}`;
        }
        list.splice(list.indexOf(original) + 1, 0, copy);
        return copy;
      }),
  })),
  fc
    .record({ at: n, text: fc.string({ maxLength: 4 }), patched: fc.boolean() })
    .map(({ at, text, patched }) => ({
      name: `type ${at} "${text}" ${patched ? "patch" : "page"}`,
      run: (ctx) =>
        canvasEdit(
          ctx,
          "text",
          (page) => {
            const node = nodesOf(page).filter((x) => x.type === "Heading")[at % 4];
            if (node !== undefined) node.props.text = `${String(node.props.text)}${text}`;
            return node;
          },
          (node) =>
            patched
              ? { nodeId: node.props.id, field: "text", value: String(node.props.text) }
              : undefined,
        ),
    })),
  fc.record({ at: n, size: fc.constantFrom("large", "medium", "small") }).map(({ at, size }) => ({
    name: `size ${at} ${size}`,
    run: (ctx) =>
      canvasEdit(
        ctx,
        "props",
        (page) => {
          const node = nodesOf(page).filter((x) => x.type === "Heading")[at % 4];
          if (node !== undefined) node.props.size = size;
          return node;
        },
        (node) => ({ nodeId: node.props.id, field: "size", value: size }),
      ),
  })),
  fc
    .record({
      at: n,
      device: devices,
      padding: fc.constantFrom<BoxValue>(
        { top: "s" },
        { top: "m", bottom: "m" },
        { left: "xl", right: "none" },
      ),
    })
    .map(({ at, device, padding }) => ({
      name: `padding ${at} ${device} ${JSON.stringify(padding)}`,
      run: (ctx) =>
        sectionEdit(ctx, at, "padding", (stored) => withValueAt(stored, device, padding)),
    })),
  fc.record({ at: n, device: devices }).map(({ at, device }) => ({
    name: `reset padding ${at} ${device}`,
    run: (ctx) => sectionEdit(ctx, at, "padding", (stored) => withoutOverride(stored, device)),
  })),
  fc
    .record({
      at: n,
      device: devices,
      gaps: fc.array(fc.constantFrom("none", "small", "medium", "large"), { maxLength: 4 }),
    })
    .map(({ at, device, gaps }) => ({
      name: `drag gap ${at} ${device} ${JSON.stringify(gaps)}`,
      run: (ctx) => {
        const { pageId } = ctx.session.ui.getState();
        const gesture = ctx.session.begin("props", "Changed Section gap");
        for (const gap of gaps) {
          gesture.update((draft) => {
            const page = draft.pages[pageId]?.doc;
            const section =
              page === undefined
                ? undefined
                : nodesOf(page).filter((x) => x.type === "Section")[at % 3];
            if (section !== undefined)
              section.props.gap = withValueAt(section.props.gap, device, gap);
          });
        }
        gesture.commit();
      },
    })),
  fc
    .record({
      op: fc.constantFrom("add", "move", "remove", "edit"),
      at: n,
      to: n,
      text: fc.string({ maxLength: 4 }),
    })
    .map(({ op, at, to, text }) => ({
      name: `faq ${op} ${at} ${to} "${text}"`,
      run: (ctx) =>
        faqEdit(ctx, (ids): ListChange => {
          const id = ids[at % Math.max(ids.length, 1)] ?? "none";
          switch (op) {
            case "add":
              return { type: "add" };
            case "move":
              return { type: "move", id, to: to % Math.max(ids.length, 1) };
            case "remove":
              return { type: "remove", id };
            default:
              return { type: "edit", id, name: "question", value: text };
          }
        }),
    })),
  devices.map((device) => ({
    name: `view ${device}`,
    run: (ctx) => ctx.engine.switchView(device),
  })),
  fc.string({ maxLength: 4 }).map((title) => ({
    name: `root "${title}"`,
    run: (ctx) =>
      canvasEdit(ctx, "root", (page) => {
        page.root.props.title = title;
        return undefined;
      }),
  })),
  fc.nat().map((at) => ({
    name: `show page ${at}`,
    run: (ctx) => ctx.session.showPage(ctx.pages[at % ctx.pages.length] as PageId),
  })),
  fc.string({ maxLength: 6 }).map((name) => ({
    name: `site name "${name}"`,
    run: (ctx) =>
      ctx.session.edit("page", "Changed site settings", (draft) => {
        draft.settings.general.name = name;
      }),
  })),
  fc.string({ maxLength: 6 }).map((text) => ({
    name: `footer "${text}"`,
    run: (ctx) =>
      ctx.session.edit("page", "Edited shared Footer", (draft) => {
        const footer = draft.layout.footer[0];
        if (footer !== undefined) footer.props.text = text;
      }),
  })),
  fc.string({ maxLength: 4 }).map((text) => ({
    name: `type in a copy of a shared section on the canvas "${text}"`,
    run: (ctx) => {
      // As the engine reports it (F-ED-23): an edit of the shared section, the page unchanged.
      const site = ctx.session.history.document.getState();
      const page = site.pages[ctx.session.ui.getState().pageId]?.doc;
      const section = site.sharedSections[HOURS]?.section;
      if (page === undefined || section === undefined) return;
      ctx.engine.edit({
        kind: "text",
        page,
        nodeId: copiedNodeId("hours-copy", "hours"),
        componentType: "Heading",
        field: "text",
        selection: copiedNodeId("hours-copy", "hours"),
        sharedSection: {
          id: HOURS,
          section: {
            ...section,
            props: { ...section.props, text: `${String(section.props.text)}${text}` },
          },
        },
      });
    },
  })),
  fc.record({ at: n, name: fc.constantFrom("Team", "Prices") }).map(({ at, name }) => ({
    name: `save section ${at} as shared section "${name}"`,
    run: (ctx) => {
      // As the command does (1.29): the selected section of the page; nothing for anything else.
      const { pageId } = ctx.session.ui.getState();
      const content = ctx.session.history.document.getState().pages[pageId]?.doc.content ?? [];
      const node = content[at % Math.max(content.length, 1)];
      ctx.session.select(node?.props.id ?? null);
      saveAsSharedSection(ctx.session, name);
    },
  })),
  fc.record({ at: n, inside: fc.boolean() }).map(({ at, inside }) => ({
    name: `detach copy ${at}${inside ? " from an element in it" : ""}`,
    run: (ctx) => {
      const site = ctx.session.history.document.getState();
      const { pageId } = ctx.session.ui.getState();
      const copies = (site.pages[pageId]?.doc.content ?? []).filter(isSharedCopy);
      const copy = copies[at % Math.max(copies.length, 1)];
      const section =
        copy === undefined ? undefined : site.sharedSections[copy.props.sharedSectionId]?.section;
      if (copy === undefined || section === undefined) return;
      const [first] = Array.isArray(section.props.content)
        ? (section.props.content as NodeDoc[])
        : [];
      const id = inside && first !== undefined ? first.props.id : section.props.id;
      ctx.session.select(copiedNodeId(copy.props.id, id));
      detachCopy(ctx.session);
    },
  })),
  fc
    .record({ at: n, name: fc.constantFrom("Team", "team ", "Opening hours", "Prices") })
    .map(({ at, name }) => ({
      name: `rename shared section ${at} "${name}"`,
      run: (ctx) => {
        const ids = Object.keys(ctx.session.history.document.getState().sharedSections);
        const id = ids[at % Math.max(ids.length, 1)];
        if (id !== undefined) renameSharedSection(ctx.session, id as SharedSectionId, name);
      },
    })),
  n.map((at) => ({
    name: `delete shared section ${at}`,
    run: (ctx) => {
      // Its copies on every page become normal sections (F-ED-23), as one step.
      const ids = Object.keys(ctx.session.history.document.getState().sharedSections);
      const id = ids[at % Math.max(ids.length, 1)];
      if (id !== undefined) deleteSharedSection(ctx.session, id as SharedSectionId);
    },
  })),
  fc.string({ maxLength: 4 }).map((text) => ({
    name: `edit a copy's element in the Edit panel "${text}"`,
    run: (ctx) => {
      // As the Edit panel does for an element of a copy: in the shared section itself.
      const site = ctx.session.history.document.getState();
      ctx.session.edit("text", "Edited shared section 'Opening hours'", (draft) => {
        updateSectionField(
          draft,
          site,
          HOURS,
          "hours",
          "text",
          (stored) => `${String(stored)}${text}`,
        );
      });
    },
  })),
  fc.string({ maxLength: 4 }).map((text) => ({
    name: `type in the footer on the canvas "${text}"`,
    run: (ctx) => {
      // As the engine reports it (F-ED-7): a shared edit, with the layout after it.
      const site = ctx.session.history.document.getState();
      const page = site.pages[ctx.session.ui.getState().pageId]?.doc;
      const [footer] = site.layout.footer;
      if (page === undefined || footer === undefined) return;
      ctx.engine.edit({
        kind: "text",
        page,
        nodeId: footer.props.id,
        componentType: "Footer",
        field: "text",
        selection: footer.props.id,
        shared: true,
        layout: {
          ...site.layout,
          footer: [
            { ...footer, props: { ...footer.props, text: `${String(footer.props.text)}${text}` } },
          ],
        },
      });
    },
  })),
  fc
    .record({
      names: fc.array(fc.string({ maxLength: 4 }), { maxLength: 5 }),
      end: fc.constantFrom("commit", "esc", "edit"),
    })
    .map(({ names, end }) => ({
      name: `drag site name ${JSON.stringify(names)} then ${end}`,
      run: (ctx) => {
        const gesture = ctx.session.begin("props", "Changed site name");
        for (const name of names) {
          gesture.update((draft) => {
            draft.settings.general.name = name;
          });
        }
        if (end === "commit") gesture.commit();
        else if (end === "esc") runHistoryCommand(ctx.session, "cancel");
        // "edit": the next edit ends the gesture as it is; left open until then.
      },
    })),
  fc.nat({ max: 1_500 }).map((ms) => ({
    name: `wait ${ms}ms`,
    run: () => vi.advanceTimersByTime(ms),
  })),
  fc.nat({ max: 20 }).map((at) => ({
    name: `select ${at}`,
    run: (ctx) => {
      const page = ctx.shown();
      const node = page === undefined ? undefined : nodesOf(page)[at];
      ctx.engine.selectFromCanvas(node?.props.id ?? null);
    },
  })),
  // Several selected elements (1.31): any of the page's, some not layers (refused, with a reason),
  // then the bulk actions on them.
  fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 4 }).map((ats) => ({
    name: `select several ${ats.join(" ")}`,
    run: (ctx) => {
      const page = ctx.shown();
      const nodes = page === undefined ? [] : nodesOf(page);
      const ids = ats.flatMap((at) => {
        const node = nodes[at % Math.max(nodes.length, 1)];
        if (node === undefined) return [];
        // A linked copy is selected by the id the canvas shows its section by.
        return [isSharedCopy(node) ? copiedNodeId(node.props.id, "hours") : node.props.id];
      });
      ctx.session.selectElements(ids);
    },
  })),
  fc
    .constantFrom(
      ["delete", deleteSelected] as const,
      ["duplicate", duplicateSelected] as const,
      ["hide or show", toggleSelectedHidden] as const,
      ["move up", (session: EditorSession) => moveSelected(session, "up")] as const,
      ["move down", (session: EditorSession) => moveSelected(session, "down")] as const,
    )
    .map(([name, act]) => ({
      name: `${name} the selected elements`,
      run: (ctx) => {
        ctx.connection.flush();
        act(ctx.session);
      },
    })),
  // Select similar, then a Ctrl/Cmd-drag copy in Layers, with Shift or not (1.35).
  fc.constant<Command>({
    name: "select similar",
    run: (ctx) => {
      const { nodeId } = ctx.session.ui.getState();
      const ids = nodeId === null ? undefined : similarTo(ctx.session, nodeId);
      if (ids !== undefined) ctx.session.selectElements(ids);
    },
  }),
  fc.record({ at: fc.nat({ max: 6 }), linked: fc.boolean() }).map(({ at, linked }) => ({
    name: `copy the selected layer to ${at}${linked ? " linked" : ""}`,
    run: (ctx) => {
      ctx.connection.flush();
      const { nodeId } = ctx.session.ui.getState();
      if (nodeId !== null) copyLayer(ctx.session, nodeId, at, linked);
    },
  })),
  fc.constant<Command>({
    name: "undo",
    run: (ctx) => {
      ctx.connection.flush();
      ctx.session.history.undo();
    },
  }),
  fc.constant<Command>({
    name: "redo",
    run: (ctx) => {
      ctx.connection.flush();
      ctx.session.history.redo();
    },
  }),
  fc.nat().map((at) => ({
    name: `jump ${at}`,
    run: (ctx) => {
      ctx.connection.flush();
      const entries = ctx.session.history.entries();
      ctx.session.history.jumpTo(
        entries.length === 0 ? null : (entries[at % entries.length]?.id ?? null),
      );
    },
  })),
];

describe("undo invariant over the editor session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("undo all restores the opened site, redo all the final one, and the canvas follows", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(...commands), { maxLength: 40 }), (sequence) => {
        const ctx = setup();
        const { session } = ctx;
        const initial = session.history.document.getState();
        const canvasShowsCurrentPage = () =>
          expect(ctx.shown()).toEqual(
            session.history.document.getState().pages[session.ui.getState().pageId]?.doc,
          );

        for (const command of sequence) {
          command.run(ctx);
          canvasShowsCurrentPage();
        }
        ctx.connection.flush();
        vi.advanceTimersByTime(TEXT_SESSION_GRACE_MS);
        // A gesture still open at the end is released as the user lets go.
        ctx.session.begin("props", "Release").commit();
        const current = session.history.document.getState();
        const { entries, cursor } = session.history.state.getState();

        session.history.jumpTo(null);
        expect(session.history.document.getState()).toEqual(initial);
        canvasShowsCurrentPage();

        session.history.jumpTo(entries[cursor - 1]?.id ?? null);
        expect(session.history.document.getState()).toEqual(current);
        canvasShowsCurrentPage();

        // Step by step agrees with jumping.
        while (session.history.redo()) canvasShowsCurrentPage();
        const final = session.history.document.getState();
        while (session.history.undo()) canvasShowsCurrentPage();
        expect(session.history.document.getState()).toEqual(initial);
        session.history.jumpTo(entries.at(-1)?.id ?? null);
        expect(session.history.document.getState()).toEqual(final);
        ctx.connection.disconnect();
      }),
      { numRuns: 200 },
    );
    // 200 sequences of up to 40 actions: seconds of work, more under coverage on a busy machine.
  }, 60_000);
});
