import { describe, expect, it } from "vitest";
import { linkToOpen, webAddress } from "./assistant-links.js";
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

  it("opens a link as the reply wrote it, or a review card's, and nothing else", () => {
    const reply = turn(
      "See [the page](https://a.example/x), https://b.example/y, <https://c.example/z> or www.e.example/w.",
      [{ host: "d.example", href: "https://d.example/" }],
    );
    // Each as the panel's Markdown tokens give it, and as main opens it.
    expect(linkToOpen(reply, "https://a.example/x")).toBe("https://a.example/x");
    expect(linkToOpen(reply, "https://b.example/y")).toBe("https://b.example/y");
    expect(linkToOpen(reply, "https://c.example/z")).toBe("https://c.example/z");
    expect(linkToOpen(reply, "http://www.e.example/w")).toBe("http://www.e.example/w");
    expect(linkToOpen(reply, "https://d.example")).toBe("https://d.example/");
    expect(linkToOpen(reply, "https://a.example/other")).toBeUndefined();
    expect(linkToOpen(reply, "https://evil.example/")).toBeUndefined();
    expect(linkToOpen(reply, "http://www.evil.example/")).toBeUndefined();
    expect(
      linkToOpen(turn("Try [this](javascript:alert(1))"), "javascript:alert(1)"),
    ).toBeUndefined();
    expect(linkToOpen(turn("file:///etc/passwd"), "file:///etc/passwd")).toBeUndefined();
  });

  it("answers at once for a reply built to stall a pattern (#1001's review)", () => {
    // 200k characters of unclosed Markdown links, the longest reply, against the longest href.
    const stalling = turn("](a".repeat(66_667));
    const started = performance.now();
    expect(linkToOpen(stalling, `https://a.example/${"a".repeat(1_970)}`)).toBeUndefined();
    expect(linkToOpen(stalling, "http://www.a.example/")).toBeUndefined();
    expect(performance.now() - started).toBeLessThan(50);
  });
});
