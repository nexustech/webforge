// Security review S18 (docs/reviews/2026-10-30-security-review.md), restored by #658.
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
            id: "section",
            content: [
              {
                type: "BuyButton",
                props: {
                  id: "buy",
                  label: "Buy",
                  price: "£5",
                  link: "https://pay.rosas.example/x",
                  alignment: "left",
                },
              },
            ],
          },
        },
        {
          type: "Newsletter",
          props: { id: "nl", title: "News", action: "https://list.rosas.example/s" },
        },
      ],
    },
    layout: {
      header: [{ type: "Header", props: { id: "header", siteName: "Rosa's Bakery" } }],
      footer: [{ type: "Footer", props: { id: "footer", text: "Thanks" } }],
    },
  });
}

describe("security: AI apps repointing money and data destinations", () => {
  it.each([
    ["buy", { link: "https://evil.example/pay" }],
    ["nl", { action: "https://evil.example/collect" }],
  ])(
    "asks the person or refuses before %s is repointed off-site in Content mode",
    async (nodeId, values) => {
      const history = createHistoryManager<SiteDoc>({ initial: site() });
      const confirm = vi.fn<CommandHost["confirm"]>(async () => false);
      const host = {
        history,
        run: vi.fn<CommandHost["run"]>((label, recipe) => history.run(label, recipe)),
        editing: () => false,
        mode: () => "content" as const,
        confirm,
      };
      const api = createCommandApi(host);
      const location = { kind: "page" as const, pageId: history.document.getState().homePageId };
      const result = await api.run("updateFields", { location, nodeId, values }, { app: "Claude" });
      // Secure behaviour: either refused outright, or the person was asked (and here said no).
      expect(result.status === "done" && confirm.mock.calls.length === 0).toBe(false);
    },
  );
});
