import { describe, expect, it } from "vitest";
import { linkInTurn, webAddress } from "./assistant-links.js";
import type { ConversationTurn } from "./ipc/assistant.js";

const turn = (reply: string, links: ConversationTurn["links"] = []): ConversationTurn => ({
  replyId: "2d3e4f5a-6b7c-4d8e-9fa0-b1c2d3e4f5a6",
  message: "Hello",
  reply,
  state: "done",
  costUsd: null,
  steps: [],
  links,
});

describe("a reply's links (ADR 0026 §7, openLink)", () => {
  it("takes only web addresses, as the panel shows them", () => {
    expect(webAddress("https://example.com")).toBe("https://example.com/");
    expect(webAddress("http://example.com/a b")).toBe("http://example.com/a%20b");
    expect(webAddress("javascript:alert(1)")).toBeUndefined();
    expect(webAddress("file:///etc/passwd")).toBeUndefined();
    expect(webAddress("mailto:a@b.example")).toBeUndefined();
    expect(webAddress("not a url")).toBeUndefined();
  });

  it("finds a Markdown link, a bare address or a review card's link, and nothing else", () => {
    const reply = turn(
      "See [the page](https://a.example/x) and https://b.example/y, or <https://c.example/z>.",
      [{ host: "d.example", href: "https://d.example/" }],
    );
    for (const href of [
      "https://a.example/x",
      "https://b.example/y",
      "https://c.example/z",
      "https://d.example",
    ]) {
      expect(linkInTurn(reply, href)).toBe(true);
    }
    expect(linkInTurn(reply, "https://a.example/other")).toBe(false);
    expect(linkInTurn(reply, "https://b.example/y.")).toBe(false);
    expect(linkInTurn(turn("Try [this](javascript:alert(1))"), "javascript:alert(1)")).toBe(false);
  });
});
