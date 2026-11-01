// Security review S19 (docs/reviews/2026-10-30-security-review.md), restored by #658.
import { createHistoryManager } from "@webforge/history";
import { createSite, type SiteDoc } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { createCommandApi } from "./api.js";
import type { CommandHost } from "./types.js";

function site(): SiteDoc {
  return createSite({
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
            id: "sec",
            content: [
              { type: "CustomCode", props: { id: "cc", code: "<script>consent()</script>" } },
            ],
          },
        },
        { type: "Section", props: { id: "sec2", content: [] } },
      ],
    },
    layout: {
      header: [{ type: "Header", props: { id: "header", siteName: "Rosa's Bakery" } }],
      footer: [{ type: "Footer", props: { id: "footer", text: "Thanks" } }],
    },
  });
}

function setup() {
  const history = createHistoryManager<SiteDoc>({ initial: site() });
  const host: CommandHost = {
    history,
    run: vi.fn<CommandHost["run"]>((label, recipe) => history.run(label, recipe)),
    editing: () => false,
    mode: () => "design" as const,
    confirm: vi.fn<CommandHost["confirm"]>(async () => true),
  } as unknown as CommandHost;
  const home = { kind: "page" as const, pageId: history.document.getState().homePageId };
  return { history, api: createCommandApi(host), home };
}

describe("security: AI apps and Custom Code", () => {
  it("refuses to remove a Custom Code element", async () => {
    const { history, api, home } = setup();
    const before = history.document.getState();
    const result = await api.run("removeNode", { location: home, nodeId: "cc" }, { app: "X" });
    expect(result.status).toBe("refused");
    expect(history.document.getState()).toBe(before);
  });

  it("refuses to move a Custom Code element to another section", async () => {
    const { history, api, home } = setup();
    const before = history.document.getState();
    const result = await api.run(
      "moveNode",
      { location: home, nodeId: "cc", parentId: "sec2", slot: "content", index: 0 },
      { app: "X" },
    );
    expect(result.status).toBe("refused");
    expect(history.document.getState()).toBe(before);
  });

  it("refuses to remove a Section that holds Custom Code", async () => {
    const { history, api, home } = setup();
    const before = history.document.getState();
    const result = await api.run("removeNode", { location: home, nodeId: "sec" }, { app: "X" });
    expect(result.status).toBe("refused");
    expect(history.document.getState()).toBe(before);
  });
});
