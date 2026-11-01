import { createHistoryManager, type HistoryManager } from "@webforge/history";
import {
  createSite,
  type NodeDoc,
  newId,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_TIMEOUT_MS, createCommandApi } from "./api.js";
import type { CommandHost, Confirmation } from "./types.js";

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

type Setup = {
  readonly history: HistoryManager<SiteDoc, null>;
  readonly host: CommandHost & { editing: () => boolean; mode: () => "design" | "content" };
  readonly confirm: ReturnType<typeof vi.fn<CommandHost["confirm"]>>;
};

function setup(answer: boolean | "never" = true, edit?: (doc: SiteDoc) => void): Setup {
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
    confirm,
  };
  return { history, host, confirm };
}

const home = (history: Setup["history"]) => {
  const doc = history.document.getState();
  return { kind: "page" as const, pageId: doc.homePageId };
};
const content = (history: Setup["history"]): NodeDoc[] => {
  const doc = history.document.getState();
  return doc.pages[doc.homePageId]?.doc.content ?? [];
};
const app = { app: "Claude" };

const HOURS = "shared-hours" as SharedSectionId;
const about = (doc: SiteDoc) => {
  const id = doc.pageOrder.at(-1);
  const page = id === undefined ? undefined : doc.pages[id];
  if (page === undefined) throw new Error("no About page");
  return page;
};

/**
 * Opening hours as a shared section, with linked copies on the home and About pages (the About
 * page's named and hidden in Layers), and an element of a type the catalogue doesn't know.
 */
function withHours(doc: SiteDoc): void {
  doc.sharedSections[HOURS] = {
    id: HOURS,
    name: "Opening hours",
    section: {
      type: "Section",
      props: {
        id: "hours",
        content: [{ type: "Heading", props: { id: "hours-title", text: "Hours" } }],
      },
    },
  };
  doc.pages[doc.homePageId]?.doc.content.push({
    type: SHARED_COPY_TYPE,
    props: { id: "copy-home", sharedSectionId: HOURS },
  });
  about(doc).doc.content.push(
    {
      type: SHARED_COPY_TYPE,
      props: { id: "copy-about", sharedSectionId: HOURS, layerName: "Hours here", hidden: true },
    },
    { type: "Retired", props: { id: "retired", layerName: "Old banner", hidden: true } },
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the command API's queries (4.8)", () => {
  it("reads the outline, a page tree, an element's fields, Site Settings and the theme", () => {
    const { history, host } = setup();
    const api = createCommandApi(host);

    const outline = api.query("outline", {});
    expect(outline).toMatchObject({
      status: "done",
      data: {
        name: "Rosa's Bakery",
        pages: [{ title: "Home" }, { title: "Not found" }, { title: "About" }],
      },
    });
    expect(api.query("pageTree", { location: home(history) })).toMatchObject({
      status: "done",
      data: [
        {
          id: "section",
          type: "Section",
          label: "Section",
          slots: { content: [{ id: "heading" }] },
        },
        { id: "hero", type: "Hero", label: "Hero" },
      ],
    });
    const fields = api.query("fields", { location: home(history), nodeId: "hero" });
    expect(fields).toMatchObject({
      status: "done",
      data: { type: "Hero", fields: { title: { kind: "text", value: "Fresh bread" } } },
    });
    expect(api.query("settings", {})).toMatchObject({
      status: "done",
      data: { general: { name: "Rosa's Bakery" } },
    });
    expect(api.query("theme", {})).toMatchObject({ status: "done", data: { preset: "light" } });
  });

  it("says what's wrong with a query, or that what it names isn't there", () => {
    const { host } = setup();
    const api = createCommandApi(host);
    expect(api.query("everything", {}).status).toBe("invalid");
    expect(api.query("pageTree", { location: { kind: "page" } }).status).toBe("invalid");
    expect(api.query("pageTree", { location: { kind: "page", pageId: "nope" } }).status).toBe(
      "not-found",
    );
    expect(
      api.query("fields", { location: { kind: "layout", part: "header" }, nodeId: "nope" }).status,
    ).toBe("not-found");
  });
});

describe("the command API's queries of shared sections (4.8)", () => {
  it("reads linked copies, a shared section's own section, and elements it doesn't know", () => {
    const { history, host } = setup(true, withHours);
    const api = createCommandApi(host);
    const aboutPage = { kind: "page", pageId: about(history.document.getState()).id };

    expect(api.query("pageTree", { location: aboutPage })).toEqual({
      status: "done",
      data: [
        {
          id: "copy-about",
          type: SHARED_COPY_TYPE,
          label: "Hours here",
          hidden: true,
          sharedSectionId: HOURS,
        },
        { id: "retired", type: "Retired", label: "Old banner", hidden: true },
      ],
    });
    expect(api.query("pageTree", { location: home(history) })).toMatchObject({
      data: [{}, {}, { id: "copy-home", label: "Opening hours", sharedSectionId: HOURS }],
    });
    expect(
      api.query("pageTree", { location: { kind: "shared", sharedSectionId: HOURS } }),
    ).toMatchObject({
      status: "done",
      data: [{ id: "hours", slots: { content: [{ id: "hours-title", label: "Heading" }] } }],
    });
    expect(api.query("outline", {})).toMatchObject({
      data: { sharedSections: [{ id: HOURS, name: "Opening hours" }] },
    });
    expect(
      api.query("pageTree", { location: { kind: "shared", sharedSectionId: "gone" } }).status,
    ).toBe("not-found");
    expect(api.query("fields", { location: aboutPage, nodeId: "retired" })).toEqual({
      status: "done",
      data: { type: "Retired", label: "Retired", fields: {} },
    });
  });

  it("gives a field's help, and leaves out slots", () => {
    const { history, host } = setup();
    const fields = createCommandApi(host).query("fields", {
      location: home(history),
      nodeId: "section",
    });
    if (fields.status !== "done") throw new Error(fields.status);
    const read = fields.data as { fields: Record<string, { help?: string }> };
    expect(read.fields.colors?.help).toEqual(expect.any(String));
    expect(read.fields.content).toBeUndefined();
  });
});

describe("the command API's commands (4.8)", () => {
  it("adds a section to a page and an element to a slot, each one labelled undo step", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const initial = history.document.getState();

    const hero = await api.run(
      "addNode",
      { location: home(history), type: "Hero", values: { title: "Cakes" }, index: 0 },
      app,
    );
    expect(hero).toMatchObject({ status: "done", label: "AI (Claude): Added Hero" });
    expect(content(history)[0]).toMatchObject({
      type: "Hero",
      props: { title: "Cakes", variant: "split" },
    });

    const text = await api.run(
      "addNode",
      { location: home(history), type: "Text", parentId: "section", slot: "content" },
      app,
    );
    expect(text.status).toBe("done");
    expect(history.state.getState().entries.map((entry) => entry.label)).toEqual([
      "AI (Claude): Added Hero",
      "AI (Claude): Added Text",
    ]);
    history.undo();
    history.undo();
    expect(history.document.getState()).toEqual(initial);
  });

  it("gives what it adds ids of its own, its default children's too", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    await api.run("addNode", { location: home(history), type: "Section", values: {} }, app);
    await api.run("addNode", { location: home(history), type: "Section", values: {} }, app);
    const ids = JSON.stringify(content(history)).match(/"id":"[^"]+"/g) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts things only where they can go", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const where = (input: object) => api.run("addNode", { location: home(history), ...input }, app);

    expect((await where({ type: "Text" })).status).toBe("refused");
    expect((await where({ type: "Hero", parentId: "section", slot: "content" })).status).toBe(
      "refused",
    );
    expect((await where({ type: "Text", parentId: "section", slot: "nowhere" })).status).toBe(
      "refused",
    );
    expect((await where({ type: "Text", parentId: "missing", slot: "content" })).status).toBe(
      "not-found",
    );
    expect((await where({ type: "CustomCode", parentId: "section", slot: "content" })).status).toBe(
      "refused",
    );
    expect((await where({ type: "Spaceship" })).status).toBe("invalid");
    expect(history.state.getState().entries).toEqual([]);
  });

  it("rejects invalid input with a readable error, changing nothing", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const initial = history.document.getState();
    const bad = [
      ["addNode", { location: home(history), type: "Hero", values: { variant: "sideways" } }],
      ["addNode", { location: home(history), type: "Hero", values: { nonsense: 1 } }],
      ["updateFields", { location: home(history), nodeId: "hero", values: { title: 3 } }],
      ["updateFields", { location: home(history), nodeId: "hero", values: {} }],
      ["editText", { location: home(history), nodeId: "hero", field: "image", text: "x" }],
      ["setThemeTokens", { tokens: { spacing: "enormous" } }],
      ["addPage", { title: "   " }],
      ["addPage", { title: 3 }],
      ["unknownCommand", {}],
    ] as const;
    for (const [name, input] of bad) {
      const result = await api.run(name, input, app);
      expect(result.status, name).toBe("invalid");
      expect("message" in result && result.message.length > 0, name).toBe(true);
    }
    expect(history.document.getState()).toBe(initial);
    expect(history.state.getState().entries).toEqual([]);
  });

  it("edits text and fields, moves and removes elements", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const location = home(history);

    expect(
      await api.run("editText", { location, nodeId: "heading", field: "text", text: "Hello" }, app),
    ).toMatchObject({ status: "done", label: "AI (Claude): Edited Heading text" });
    expect(
      await api.run("updateFields", { location, nodeId: "hero", values: { title: "Rolls" } }, app),
    ).toMatchObject({ status: "done", label: "AI (Claude): Edited Hero Title" });
    expect((await api.run("moveNode", { location, nodeId: "hero", index: 0 }, app)).status).toBe(
      "done",
    );
    expect(content(history).map((node) => node.props.id)).toEqual(["hero", "section"]);
    expect(
      (
        await api.run(
          "moveNode",
          { location, nodeId: "section", parentId: "section", slot: "content", index: 0 },
          app,
        )
      ).status,
    ).toBe("refused");
    expect((await api.run("removeNode", { location, nodeId: "heading" }, app)).status).toBe("done");
    expect(vi.mocked(host.run).mock.calls.map(([, , kind]) => kind)).toEqual([
      "text",
      "props",
      "move",
      "remove",
    ]);
    expect(content(history)[1]?.props.content).toEqual([]);
    expect(
      (
        await api.run(
          "removeNode",
          { location: { kind: "layout", part: "header" }, nodeId: "header" },
          app,
        )
      ).status,
    ).toBe("refused");
  });

  it("adds a page before 'Page not found'", async () => {
    const { history, host } = setup();
    const result = await createCommandApi(host).run("addPage", { title: "Menu" }, app);
    expect(result).toMatchObject({ status: "done", label: "AI (Claude): Added page 'Menu'" });
    if (result.status !== "done" || result.id === undefined) throw new Error("no page");
    const page = history.document.getState().pages[result.id as PageId];
    expect(page).toMatchObject({ title: "Menu", slug: "menu" });
  });

  it("merges a group of tokens it names in part, keeping the rest (#645)", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const before = history.document.getState().theme;
    const heading = { family: "Lora", fallback: "serif" } as const;

    // The shape AI apps sent before 3.22 added the accent: heading only, the rest kept.
    expect((await api.run("setThemeTokens", { tokens: { fonts: { heading } } }, app)).status).toBe(
      "done",
    );
    const fonts = history.document.getState().theme.fonts;
    expect(fonts).toEqual({ ...before.fonts, heading });

    // One corner, and one text style: the other corners and styles stay.
    const tokens = {
      radius: { box: "xl" },
      typeScale: { h1: { ...before.typeScale.h1, weight: 800 } },
    };
    expect((await api.run("setThemeTokens", { tokens }, app)).status).toBe("done");
    const theme = history.document.getState().theme;
    expect(theme.radius).toEqual({ ...before.radius, box: "xl" });
    expect(theme.typeScale).toEqual({
      ...before.typeScale,
      h1: { ...before.typeScale.h1, weight: 800 },
    });
    expect(theme.spacing).toBe(before.spacing);

    // A merged result that isn't a theme is still refused, readably, changing nothing.
    const entries = history.state.getState().entries.length;
    for (const bad of [{ radius: { box: "huge" } }, { fonts: { heading: { family: "Lora" } } }]) {
      const result = await api.run("setThemeTokens", { tokens: bad }, app);
      expect(result).toMatchObject({ status: "invalid", message: expect.stringMatching(/\S/) });
    }
    expect(history.document.getState().theme).toBe(theme);
    expect(history.state.getState().entries).toHaveLength(entries);

    // A `__proto__` from an AI app's JSON is no token: it changes nothing.
    const prototype: unknown = JSON.parse('{ "__proto__": { "spacing": "roomy" } }');
    await api.run("setThemeTokens", { tokens: prototype }, app);
    expect(history.document.getState().theme).toEqual(theme);
  });

  it("waits for the person to allow a change to more than one page (D7), declined after a minute", async () => {
    vi.useFakeTimers();
    const allowed = setup(true);
    const tokens = { tokens: { spacing: "roomy" } };
    expect(await createCommandApi(allowed.host).run("setThemeTokens", tokens, app)).toMatchObject({
      status: "done",
      label: "AI (Claude): Changed the theme",
    });
    expect(allowed.confirm.mock.calls[0]?.[0]).toEqual<Confirmation>({
      action: "Allow Claude to change the theme?",
      confirm: "Allow",
      affectedPages: 3,
    });

    const refused = setup(false);
    expect((await createCommandApi(refused.host).run("setThemeTokens", tokens, app)).status).toBe(
      "declined",
    );

    const unanswered = setup("never");
    const waiting = createCommandApi(unanswered.host).run("setThemeTokens", tokens, app);
    await vi.advanceTimersByTimeAsync(CONFIRM_TIMEOUT_MS);
    expect((await waiting).status).toBe("declined");
    expect(unanswered.confirm.mock.calls[0]?.[1].aborted).toBe(true);
    expect(unanswered.history.state.getState().entries).toEqual([]);

    // The Header is on every page; the home page's own elements aren't.
    const header = setup(true);
    const api = createCommandApi(header.host);
    await api.run(
      "updateFields",
      {
        location: { kind: "layout", part: "header" },
        nodeId: "header",
        values: { siteName: "Rosa's" },
      },
      app,
    );
    expect(header.confirm.mock.calls[0]?.[0]).toMatchObject({
      action: "Allow Claude to change the Header?",
      affectedPages: 3,
    });
    await api.run(
      "editText",
      { location: home(header.history), nodeId: "heading", field: "text", text: "Hi" },
      app,
    );
    expect(header.confirm).toHaveBeenCalledOnce();
  });

  it("is busy while the person drags, scrubs a slider or types, and changes nothing", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const edit = { location: home(history), nodeId: "heading", field: "text", text: "Hi" };

    const gesture = history.begin("Moved Hero");
    expect((await api.run("editText", edit, app)).status).toBe("busy");
    gesture.cancel();

    host.editing = () => true;
    expect((await api.run("editText", edit, app)).status).toBe("busy");
    expect(history.state.getState().entries).toEqual([]);
  });

  it("allows content edits only in Content mode", async () => {
    const { history, host } = setup();
    host.mode = () => "content";
    const api = createCommandApi(host);
    const location = home(history);

    expect((await api.run("addNode", { location, type: "Hero" }, app)).status).toBe("refused");
    expect((await api.run("removeNode", { location, nodeId: "hero" }, app)).status).toBe("refused");
    expect((await api.run("addPage", { title: "Menu" }, app)).status).toBe("refused");
    expect(
      (
        await api.run(
          "updateFields",
          { location, nodeId: "hero", values: { variant: "centred" } },
          app,
        )
      ).status,
    ).toBe("refused");
    expect(
      (await api.run("updateFields", { location, nodeId: "hero", values: { title: "Pies" } }, app))
        .status,
    ).toBe("done");
    expect(
      (await api.run("editText", { location, nodeId: "heading", field: "text", text: "Hi" }, app))
        .status,
    ).toBe("done");
  });
});

describe("the command API's commands on shared parts (4.8)", () => {
  it("asks before changing a shared section on more than one page, not its copy on one", async () => {
    const { history, host, confirm } = setup(true, withHours);
    const api = createCommandApi(host);
    const shared = { kind: "shared", sharedSectionId: HOURS } as const;

    expect(
      await api.run(
        "editText",
        { location: shared, nodeId: "hours-title", field: "text", text: "Open" },
        app,
      ),
    ).toMatchObject({ status: "done", label: "AI (Claude): Edited Heading text" });
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({
      action: "Allow Claude to change the shared section Opening hours?",
      affectedPages: 2,
    });
    expect((await api.run("removeNode", { location: shared, nodeId: "hours" }, app)).status).toBe(
      "refused",
    );
    expect(
      (await api.run("removeNode", { location: home(history), nodeId: "copy-home" }, app)).status,
    ).toBe("done");
    expect(confirm).toHaveBeenCalledOnce();

    // With one copy left, the shared section shows on one page: no question.
    await api.run(
      "editText",
      { location: shared, nodeId: "hours-title", field: "text", text: "Hours" },
      app,
    );
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("counts only the pages that show the Header, and never removes the Footer", async () => {
    const { host, confirm } = setup(true, (doc) => {
      about(doc).settings.hideHeader = true;
    });
    const api = createCommandApi(host);
    const header = { kind: "layout", part: "header" } as const;
    await api.run(
      "updateFields",
      { location: header, nodeId: "header", values: { siteName: "Rosa's" } },
      app,
    );
    expect(confirm.mock.calls[0]?.[0].affectedPages).toBe(2);
    expect((await api.run("addNode", { location: header, type: "Text" }, app)).status).toBe(
      "refused",
    );
    expect(
      (
        await api.run(
          "removeNode",
          { location: { kind: "layout", part: "footer" }, nodeId: "footer" },
          app,
        )
      ).status,
    ).toBe("refused");
  });

  it("plans again once the person allows a change, and is busy if they started editing", async () => {
    const edit = {
      location: { kind: "layout", part: "header" },
      nodeId: "header",
      values: { siteName: "Rosa's" },
    } as const;

    const removed = setup();
    removed.confirm.mockImplementation(async () => {
      removed.history.run("Deleted Header", (draft) => {
        draft.layout.header = [];
      });
      return true;
    });
    expect((await createCommandApi(removed.host).run("updateFields", edit, app)).status).toBe(
      "not-found",
    );

    const dragging = setup();
    dragging.confirm.mockImplementation(async () => {
      dragging.history.begin("Moved Hero");
      return true;
    });
    expect((await createCommandApi(dragging.host).run("updateFields", edit, app)).status).toBe(
      "busy",
    );
  });
});

describe("the command API's moves and fields (4.8)", () => {
  /** A Section without a content list yet, Columns in the first, and Custom Code. */
  const nested = (doc: SiteDoc) => {
    const top = doc.pages[doc.homePageId]?.doc.content;
    const section = top?.[0];
    if (top === undefined || section === undefined) throw new Error("no section");
    top.push({ type: "Section", props: { id: "bare" } });
    (section.props.content as NodeDoc[]).push(
      {
        type: "Columns",
        props: {
          id: "columns",
          columns: [{ type: "Column", props: { id: "column", content: [] } }],
        },
      },
      { type: "CustomCode", props: { id: "code", html: "<b>hi</b>" } },
    );
  };

  it("moves an element into another section's slot, making the slot's list", async () => {
    const { history, host } = setup(true, nested);
    const api = createCommandApi(host);
    const location = home(history);
    const move = (input: object) =>
      api.run("moveNode", { location, nodeId: "heading", index: 0, ...input }, app);

    expect((await move({ parentId: "bare", slot: "content" })).status).toBe("done");
    expect(content(history).at(-1)?.props.content).toMatchObject([{ props: { id: "heading" } }]);
    expect((await move({ parentId: "column", slot: "content", index: 9 })).status).toBe("done");
    expect((await move({ parentId: "nowhere", slot: "content" })).status).toBe("not-found");
    expect((await move({ nodeId: "nothing" })).status).toBe("not-found");
    expect(
      (
        await api.run(
          "moveNode",
          { location, nodeId: "section", parentId: "column", slot: "content", index: 0 },
          app,
        )
      ).status,
    ).toBe("refused");
  });

  it("refuses a link or image to a page or file the site doesn't have", async () => {
    const { history, host } = setup();
    const api = createCommandApi(host);
    const location = home(history);
    const about = history.document.getState().pageOrder.at(-1);
    const set = (values: object) =>
      api.run("updateFields", { location, nodeId: "hero", values }, app);

    expect(await set({ buttonLink: { kind: "page", pageId: "page-gone" } })).toMatchObject({
      status: "not-found",
      message: 'There is no page "page-gone".',
    });
    expect(await set({ image: { mediaId: "a".repeat(64) } })).toMatchObject({
      status: "not-found",
    });
    expect(
      (
        await api.run(
          "addNode",
          { location, type: "Hero", values: { buttonLink: { kind: "page", pageId: "page-gone" } } },
          app,
        )
      ).status,
    ).toBe("not-found");
    expect((await set({ buttonLink: { kind: "page", pageId: about } })).status).toBe("done");
    expect(history.state.getState().entries).toHaveLength(1);
  });

  it("names a change to several fields after the element, and leaves Custom Code alone", async () => {
    const { history, host } = setup(true, nested);
    const api = createCommandApi(host);
    const location = home(history);
    expect(
      await api.run(
        "updateFields",
        { location, nodeId: "hero", values: { title: "Pies", text: "Every day" } },
        app,
      ),
    ).toMatchObject({ status: "done", label: "AI (Claude): Edited Hero" });
    expect(
      (await api.run("updateFields", { location, nodeId: "code", values: {} }, app)).status,
    ).toBe("refused");
    expect(
      (await api.run("editText", { location, nodeId: "code", field: "html", text: "" }, app))
        .status,
    ).toBe("refused");
    expect(
      (
        await api.run(
          "updateFields",
          { location: { kind: "page", pageId: "gone" }, nodeId: "hero", values: {} },
          app,
        )
      ).status,
    ).toBe("not-found");
  });
});

describe("the command API's text and rich text (4.8)", () => {
  const HOSTILE =
    '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">a</a></p>';
  const CLEAN = "<p>Hi <a>a</a></p>";

  /** A Text element (rich text) in the home page's section. */
  const withText = (doc: SiteDoc) => {
    const section = doc.pages[doc.homePageId]?.doc.content[0];
    if (section === undefined) throw new Error("no section");
    (section.props.content as NodeDoc[]).push({
      type: "Text",
      props: { id: "text", text: "<p>Hi</p>" },
    });
  };
  const inSection = (history: Setup["history"], id: string) =>
    ((content(history)[0]?.props.content ?? []) as NodeDoc[]).find((node) => node.props.id === id);

  it("cleans rich text an AI app sets as the editor's is, however it sets it", async () => {
    const { history, host } = setup(true, withText);
    const api = createCommandApi(host);
    const location = home(history);

    const edit = { location, nodeId: "text", field: "text", text: HOSTILE };
    expect((await api.run("editText", edit, app)).status).toBe("done");
    expect(inSection(history, "text")?.props.text).toBe(CLEAN);

    await api.run("editText", { ...edit, text: "<p>Hi</p>" }, app);
    const fields = { location, nodeId: "text", values: { text: HOSTILE } };
    expect((await api.run("updateFields", fields, app)).status).toBe("done");
    expect(inSection(history, "text")?.props.text).toBe(CLEAN);

    const added = await api.run(
      "addNode",
      { location, type: "Text", parentId: "section", slot: "content", values: { text: HOSTILE } },
      app,
    );
    if (added.status !== "done" || added.id === undefined) throw new Error(added.status);
    expect(inSection(history, added.id)?.props.text).toBe(CLEAN);

    // A plain text field is shown as text, never as HTML: kept as typed.
    await api.run(
      "editText",
      { location, nodeId: "heading", field: "text", text: "<b>Hi</b>" },
      app,
    );
    expect(inSection(history, "heading")?.props.text).toBe("<b>Hi</b>");
  });

  it("refuses rich text linking to a page or file the site doesn't have", async () => {
    const { history, host } = setup(true, withText);
    const api = createCommandApi(host);
    const location = home(history);
    const aboutId = history.document.getState().pageOrder.at(-1);
    const link = (href: string) => ({
      location,
      nodeId: "text",
      field: "text",
      text: `<p><a href="${href}">Us</a></p>`,
    });

    expect(await api.run("editText", link("webforge:page/page-gone"), app)).toMatchObject({
      status: "not-found",
      message: 'There is no page "page-gone".',
    });
    expect((await api.run("editText", link(`webforge:file/${"a".repeat(64)}`), app)).status).toBe(
      "not-found",
    );
    expect(history.state.getState().entries).toEqual([]);
    expect((await api.run("editText", link(`webforge:page/${aboutId}`), app)).status).toBe("done");
    expect(inSection(history, "text")?.props.text).toBe(
      `<p><a href="webforge:page/${aboutId}">Us</a></p>`,
    );
  });

  it("checks text against its field's schema, and changes nothing when it's too long", async () => {
    const { history, host } = setup(true, withText);
    const api = createCommandApi(host);
    const long = {
      location: home(history),
      nodeId: "text",
      field: "text",
      text: "x".repeat(20_001),
    };
    expect((await api.run("editText", long, app)).status).toBe("invalid");
    expect(history.state.getState().entries).toEqual([]);
  });
});

describe("where visitors' money and details go (S18, #658)", () => {
  const PAY = "https://buy.stripe.com/rosas";
  /** The home page's Section with a Buy button paying `PAY`, and a Newsletter after it. */
  const shop = (doc: SiteDoc) => {
    const page = doc.pages[doc.homePageId];
    page?.doc.content.push(
      {
        type: "Section",
        props: {
          id: "shop",
          content: [{ type: "BuyButton", props: { id: "buy", label: "Buy", link: PAY } }],
        },
      },
      { type: "Newsletter", props: { id: "news", action: "https://list.rosas.example/join" } },
    );
  };

  it("asks before a payment link or a form address changes, in Content mode too, naming both hosts", async () => {
    for (const mode of ["design", "content"] as const) {
      const { history, host, confirm } = setup(false, shop);
      host.mode = () => mode;
      const api = createCommandApi(host);
      const location = home(history);

      const repointed = await api.run(
        "updateFields",
        { location, nodeId: "buy", values: { link: "https://pay.example.net/x" } },
        app,
      );
      expect(repointed.status).toBe("declined");
      expect(confirm.mock.calls[0]?.[0]).toEqual({
        action: "Allow Claude to change the Buy button's Payment link?",
        description: "Payment link: from buy.stripe.com to pay.example.net.",
        confirm: "Allow",
        affectedPages: 1,
      });
      const text = await api.run(
        "editText",
        { location, nodeId: "news", field: "action", text: "https://collect.example.net/" },
        app,
      );
      expect(text.status).toBe("declined");
      expect(confirm.mock.calls[1]?.[0].description).toBe(
        "Form address: from list.rosas.example to collect.example.net.",
      );
      expect(history.state.getState().entries).toEqual([]);
    }
  });

  it("names whole addresses on one host, and asks when one is added with an address", async () => {
    const { history, host, confirm } = setup(true, shop);
    const api = createCommandApi(host);
    const location = home(history);

    expect(
      await api.run(
        "updateFields",
        { location, nodeId: "buy", values: { link: "https://buy.stripe.com/theirs" } },
        app,
      ),
    ).toMatchObject({ status: "done" });
    expect(confirm.mock.calls[0]?.[0].description).toBe(
      `Payment link: from ${PAY} to https://buy.stripe.com/theirs.`,
    );
    const added = await api.run(
      "addNode",
      {
        location,
        type: "BuyButton",
        parentId: "shop",
        slot: "content",
        values: { link: "https://pay.example.net/x" },
      },
      app,
    );
    expect(added.status).toBe("done");
    expect(confirm.mock.calls[1]?.[0].description).toBe(
      "Payment link: from no address to https://pay.example.net/x.",
    );
  });

  it("names where a browser really sends visitors, keeping a long address's end", async () => {
    const { history, host, confirm } = setup(false, shop);
    const api = createCommandApi(host);
    const location = home(history);
    const repoint = async (link: string) => {
      await api.run("updateFields", { location, nodeId: "buy", values: { link } }, app);
      return confirm.mock.calls.at(-1)?.[0].description;
    };

    // A browser reads `\` as `/`: this pays evil.example, not buy.stripe.com.
    expect(await repoint("https://evil.example\\@buy.stripe.com/p")).toBe(
      "Payment link: from buy.stripe.com to evil.example.",
    );
    // A Cyrillic "у" in a look-alike host shows as punycode.
    const lookAlike = await repoint("https://buу.stripe.com/rosas");
    expect(lookAlike).toMatch(/^Payment link: from buy\.stripe\.com to xn--/);
    expect(lookAlike).not.toContain("у");
    // `../` that leaves the account's own path is resolved.
    expect(await repoint(`${PAY}/x/x/../../../theirs`)).toBe(
      `Payment link: from ${PAY} to https://buy.stripe.com/theirs.`,
    );
    // A long address is cut in the middle: where on the host it goes still shows.
    const long = await repoint(`https://buy.stripe.com/rosas/${"x".repeat(1_000)}/theirs`);
    expect(long).toContain("…");
    expect(long).toMatch(/\/theirs\.$/);
    expect(long?.length).toBeLessThan(500);
  });

  it("doesn't ask for its other fields, nor for the same address again", async () => {
    const { history, host, confirm } = setup(true, shop);
    const api = createCommandApi(host);
    const location = home(history);

    for (const values of [{ label: "Buy a loaf" }, { link: ` ${PAY} ` }]) {
      expect((await api.run("updateFields", { location, nodeId: "buy", values }, app)).status).toBe(
        "done",
      );
    }
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("Custom Code, which AI apps keep away from (S19, #658)", () => {
  /** A Section holding Custom Code beside a Heading, and an empty Section after it. */
  const coded = (doc: SiteDoc) => {
    doc.pages[doc.homePageId]?.doc.content.push(
      {
        type: "Section",
        props: {
          id: "coded",
          content: [
            { type: "Heading", props: { id: "title", text: "Hi" } },
            { type: "CustomCode", props: { id: "code", html: "<p>Hi</p>" } },
          ],
        },
      },
      { type: "Section", props: { id: "empty", content: [] } },
    );
  };

  it("moves and removes what's beside it, never it nor what holds it", async () => {
    const { history, host } = setup(true, coded);
    const api = createCommandApi(host);
    const location = home(history);
    const into = { parentId: "empty", slot: "content", index: 0 };

    for (const [command, input] of [
      ["moveNode", { location, nodeId: "code", ...into }],
      ["moveNode", { location, nodeId: "coded", parentId: null, slot: null, index: 0 }],
      ["removeNode", { location, nodeId: "code" }],
      ["removeNode", { location, nodeId: "coded" }],
    ] as const) {
      expect(await api.run(command, input, app)).toMatchObject({
        status: "refused",
        message: expect.stringContaining("Custom Code"),
      });
    }
    expect(history.state.getState().entries).toEqual([]);
    expect((await api.run("moveNode", { location, nodeId: "title", ...into }, app)).status).toBe(
      "done",
    );
    expect((await api.run("removeNode", { location, nodeId: "empty" }, app)).status).toBe("done");
  });
});

describe("every command (4.8, property)", () => {
  it("is one undo step labelled for its app, and undoing all of them restores the site", async () => {
    const command = fc.oneof(
      fc.record({
        name: fc.constant("addNode"),
        type: fc.constantFrom("Hero", "Faq", "Stats"),
        index: fc.nat(3),
      }),
      fc.record({ name: fc.constant("text"), text: fc.string({ maxLength: 40 }) }),
      fc.record({ name: fc.constant("move"), index: fc.nat(4) }),
      fc.record({ name: fc.constant("remove"), at: fc.nat(10) }),
      fc.record({ name: fc.constant("page"), title: fc.string({ minLength: 1, maxLength: 20 }) }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(command, { maxLength: 12 }), async (steps) => {
        const { history, host } = setup();
        const api = createCommandApi(host);
        const location = home(history);
        const states = [history.document.getState()];
        for (const step of steps) {
          const top = content(history);
          const target = top[(step.name === "remove" ? step.at : 0) % Math.max(top.length, 1)];
          const result =
            step.name === "addNode"
              ? await api.run("addNode", { location, type: step.type, index: step.index }, app)
              : step.name === "text"
                ? await api.run(
                    "editText",
                    { location, nodeId: "heading", field: "text", text: step.text },
                    app,
                  )
                : step.name === "move" && target !== undefined
                  ? await api.run(
                      "moveNode",
                      { location, nodeId: target.props.id, index: step.index },
                      app,
                    )
                  : step.name === "remove" && target !== undefined
                    ? await api.run("removeNode", { location, nodeId: target.props.id }, app)
                    : await api.run(
                        "addPage",
                        { title: "title" in step ? step.title : "Page" },
                        app,
                      );
          const entries = history.state.getState().entries;
          const now = history.document.getState();
          if (result.status === "done" && now !== states.at(-1)) {
            // A change is one step, labelled for its app.
            expect(entries.length).toBe(states.length);
            expect(entries.at(-1)?.label).toBe(result.label);
            expect(result.label.startsWith("AI (Claude): ")).toBe(true);
            states.push(now);
          } else {
            // Refused, or nothing to change (an element moved to where it is): no step.
            expect(entries.length).toBe(states.length - 1);
            expect(now).toBe(states.at(-1));
          }
        }
        for (let at = states.length - 1; at > 0; at--) {
          history.undo();
          expect(history.document.getState()).toEqual(states[at - 1]);
        }
      }),
      { numRuns: 60 },
    );
  });
});
