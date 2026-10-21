import type { EngineEdit } from "@webforge/engine";
import type { NodeDoc, PageDoc, PageId, SiteDoc } from "@webforge/model";
import { siteLibrary, starterPage } from "@webforge/site-components";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectEngine,
  createEditorSession,
  type EditorSession,
  type EngineConnection,
  runHistoryCommand,
  TEXT_SESSION_GRACE_MS,
} from "./editor-session.js";
import { createFakeEngine, type FakeEngine } from "./fake-engine.test-helper.js";
import { withoutOverride, withValueAt } from "./responsive-value.js";
import { starterSite } from "./starter-site.js";

// Undo invariant (U8) over the editor as wired: canvas edits of every kind on any page, page
// switches, site settings and the shared layout, interleaved with undo, redo and jumps. Undo all
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

function initialSite(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...site,
    pages: {
      ...site.pages,
      [ABOUT]: { ...home, id: ABOUT, slug: "about", title: "About", doc: starterPage() },
    },
    pageOrder: [...site.pageOrder, ABOUT],
  };
}

function setup(): Ctx {
  const site = initialSite();
  const session = createEditorSession(siteLibrary, site);
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

const commands: fc.Arbitrary<Command>[] = [
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
    .record({ at: n, device: devices, padding: fc.constantFrom("small", "medium", "large") })
    .map(({ at, device, padding }) => ({
      name: `padding ${at} ${device} ${padding}`,
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
