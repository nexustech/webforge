import { createHistoryManager } from "@webforge/history";
import { createSite, type SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import type { AiResponse } from "../../shared/ipc/ai.js";
import { createStages } from "./stages.js";

const STAGE = "5d1c2b3a-4f5e-4d6c-8b7a-9e8f7d6c5b4a";
const NEXT = "6e2d3c4b-5a6f-4e7d-9c8b-0f9e8d7c6b5a";

/** A site with a home page holding a Section, as the window's history has it. */
function site() {
  const history = createHistoryManager<SiteDoc>({
    initial: createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Not found",
      homeDoc: {
        root: { props: {} },
        content: [{ type: "Section", props: { id: "section", content: [] } }],
      },
      layout: { header: [], footer: [] },
    }),
  });
  const home = { kind: "page" as const, pageId: history.document.getState().homePageId };
  return { history, home };
}

const done = (response: AiResponse) => {
  if (response.status !== "done") throw new Error(`not done: ${response.status}`);
  return response;
};

describe("the assistant's held changes in the window (6.9e)", () => {
  it("runs a reply's commands on a draft that its later steps read, leaving the site alone", async () => {
    const { history, home } = site();
    const before = history.document.getState();
    const stages = createStages({ history, mode: () => "design", published: () => false });

    // A step builds on an earlier one: a Heading in the Hero the reply added.
    const hero = done(
      await stages.answer({
        kind: "command",
        name: "addNode",
        input: { location: home, type: "Hero", values: {} },
        app: "Assistant",
        stage: STAGE,
      }),
    );
    expect(hero).toMatchObject({
      label: "AI (Assistant): Added Hero",
      target: { pageId: home.pageId },
    });
    // The draft's step isn't the site's, so no entry to undo is named.
    expect(hero).not.toHaveProperty("entryId");
    const tree = done(
      await stages.answer({
        kind: "query",
        name: "pageTree",
        input: { location: home },
        stage: STAGE,
      }),
    );
    if (!("id" in hero) || hero.id === undefined) throw new Error("no id");
    expect(JSON.stringify(tree)).toContain(hero.id);

    // A change to every page asks nobody while staged: it's asked when applied.
    expect(
      await stages.answer({
        kind: "command",
        name: "setThemeTokens",
        input: { tokens: { spacing: "roomy" } },
        app: "Assistant",
        stage: STAGE,
      }),
    ).toMatchObject({ status: "done", label: "AI (Assistant): Changed the theme" });

    // The site and its history are as they were.
    expect(history.document.getState()).toBe(before);
    expect(history.state.getState().entries).toEqual([]);
  });

  it("starts another reply's stage from the site as it is", async () => {
    const { history, home } = site();
    const stages = createStages({ history, mode: () => "design", published: () => false });
    await stages.answer({
      kind: "command",
      name: "addNode",
      input: { location: home, type: "Hero", values: {} },
      app: "Assistant",
      stage: STAGE,
    });
    const tree = done(
      await stages.answer({
        kind: "query",
        name: "pageTree",
        input: { location: home },
        stage: NEXT,
      }),
    );
    expect(JSON.stringify(tree)).not.toContain("Hero");
  });

  it("refuses in the draft what the site would refuse: Content mode, a missing element", async () => {
    const { history, home } = site();
    const stages = createStages({ history, mode: () => "content", published: () => false });
    const added = await stages.answer({
      kind: "command",
      name: "addNode",
      input: { location: home, type: "Hero", values: {} },
      app: "Assistant",
      stage: STAGE,
    });
    expect(added.status).toBe("refused");
    const edited = await stages.answer({
      kind: "command",
      name: "editText",
      input: { location: home, nodeId: "gone", field: "text", text: "Hi" },
      app: "Assistant",
      stage: STAGE,
    });
    expect(edited.status).toBe("not-found");
  });
});
