import { createHistoryManager, type HistoryManager } from "@webforge/history";
import { createSite, type NodeDoc, newId, type SiteDoc } from "@webforge/model";
import { vi } from "vitest";
import type { CommandHost } from "./types.js";

/** A site with a home page (a Section holding a Heading, and a Hero) and an About page. */
function site(): SiteDoc {
  const doc = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    homeDoc: {
      root: { props: {} },
      content: [
        {
          type: "Section",
          props: {
            id: "section",
            content: [{ type: "Heading", props: { id: "heading", text: "Welcome" } }],
          },
        },
        { type: "Hero", props: { id: "hero", title: "Fresh bread" } },
      ],
    },
    layout: {
      header: [{ type: "Header", props: { id: "header", siteName: "Rosa's Bakery" } }],
      footer: [{ type: "Footer", props: { id: "footer", text: "Thanks" } }],
    },
  });
  const about = newId("page");
  doc.pages[about] = {
    id: about,
    kind: "page",
    slug: "about",
    title: "About",
    settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
    doc: { root: { props: {} }, content: [] },
  };
  doc.pageOrder.push(about);
  return doc;
}

export type Setup = {
  readonly history: HistoryManager<SiteDoc, null>;
  readonly host: CommandHost & { editing: () => boolean; mode: () => "design" | "content" };
  readonly confirm: ReturnType<typeof vi.fn<CommandHost["confirm"]>>;
};

export function setup(answer: boolean | "never" = true, edit?: (doc: SiteDoc) => void): Setup {
  const initial = site();
  edit?.(initial);
  const history = createHistoryManager<SiteDoc>({ initial });
  const confirm = vi.fn<CommandHost["confirm"]>(async () =>
    answer === "never" ? new Promise<boolean>(() => undefined) : answer,
  );
  const host = {
    history,
    run: vi.fn<CommandHost["run"]>((label, recipe) => history.run(label, recipe)),
    editing: () => false,
    mode: () => "design" as const,
    // Never published unless a test says so (#925).
    published: vi.fn<CommandHost["published"]>(() => false),
    confirm,
  };
  return { history, host, confirm };
}

export const home = (history: Setup["history"]) => {
  const doc = history.document.getState();
  return { kind: "page" as const, pageId: doc.homePageId };
};
export const content = (history: Setup["history"]): NodeDoc[] => {
  const doc = history.document.getState();
  return doc.pages[doc.homePageId]?.doc.content ?? [];
};
export const app = { app: "Claude" };
