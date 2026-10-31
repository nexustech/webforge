import type { NodeDoc, SiteDoc } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { TrustApi } from "../../shared/ipc/trust.js";
import { starterSite } from "../../shared/starter-site.js";
import { currentPage } from "../editor/editor-session.js";
import { sessionWith } from "../testing/fixtures.js";
import { type CodeAnswer, createCodeTrust } from "./code-trust.js";

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

const skimmer: NodeDoc = {
  type: "CustomCode",
  props: { id: "skim", code: "<script>skim()</script>" },
};

/** The starter site with code of its own: a script in Settings, an element, an allow-list. */
function siteWithCode(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...site,
    code: { ...site.code, js: "go()" },
    settings: { ...site.settings, allowedExternalUrls: ["https://cdn.example.com/"] },
    pages: {
      ...site.pages,
      [site.homePageId]: { ...home, doc: { ...home.doc, content: [...home.doc.content, skimmer] } },
    },
  };
}

/** Main's trust calls, over a record that trusts `trusted`. */
function fakeTrust(trusted: Iterable<string> = []) {
  const kept = new Set(trusted);
  const api = {
    untrusted: vi.fn<TrustApi["untrusted"]>(async (_session, texts) => ({
      status: "checked",
      untrusted: texts.flatMap((text, index) => (kept.has(text) ? [] : [index])),
    })),
    trust: vi.fn<TrustApi["trust"]>(async (_session, texts) => {
      for (const text of texts) kept.add(text);
      return { status: "trusted" };
    }),
  };
  return { api, kept };
}

function setUp(site = siteWithCode(), trusted: Iterable<string> = []) {
  const session = sessionWith(site);
  const { api, kept } = fakeTrust(trusted);
  const review = vi.fn();
  const notify = vi.fn();
  const codeTrust = createCodeTrust({ api, session, sessionId: () => SESSION, review, notify });
  /** Answers the prompt with `answer` once it asks. */
  const answerWith = async (answer: CodeAnswer) => {
    await vi.waitFor(() => expect(codeTrust.question.getState().question).not.toBeNull());
    const asked = codeTrust.question.getState().question;
    asked?.answer(answer);
    return asked?.pieces ?? [];
  };
  return { session, api, kept, review, notify, codeTrust, answerWith };
}

describe("the code trust step (#649)", () => {
  it("goes on without asking when the owner trusts all of the site's code", async () => {
    const { codeTrust, session } = setUp(siteWithCode(), [
      "go()",
      "<script>skim()</script>",
      "https://cdn.example.com/",
    ]);

    const decision = await codeTrust.confirm(session.history.document.getState());

    expect(decision).toMatchObject({ go: true, allowListConfirmed: true });
    expect(codeTrust.question.getState().question).toBeNull();
  });

  it("asks about what isn't trusted, and Keep the code trusts it from now on", async () => {
    const { codeTrust, session, api, kept, answerWith } = setUp(siteWithCode(), ["go()"]);

    const deciding = codeTrust.confirm(session.history.document.getState());
    const pieces = await answerWith("keep");

    expect(pieces.map((piece) => piece.kind)).toEqual(["element", "allowList"]);
    expect(await deciding).toMatchObject({ go: true, allowListConfirmed: true });
    expect(api.trust).toHaveBeenCalledWith(SESSION, [
      "<script>skim()</script>",
      "https://cdn.example.com/",
    ]);
    expect(kept.has("<script>skim()</script>")).toBe(true);
  });

  it("Leave it out goes on without that code this time, its allowed addresses unconfirmed", async () => {
    const { codeTrust, session, api, answerWith } = setUp(siteWithCode(), ["go()"]);

    const deciding = codeTrust.confirm(session.history.document.getState());
    await answerWith("leave");
    const decision = await deciding;

    expect(decision.go).toBe(true);
    if (!decision.go) return;
    expect(decision.keeps("go()")).toBe(true);
    expect(decision.keeps("<script>skim()</script>")).toBe(false);
    expect(decision.allowListConfirmed).toBe(false);
    expect(api.trust).not.toHaveBeenCalled();
  });

  it("Review shows the first piece and stops; closing the prompt stops too", async () => {
    const { codeTrust, session, review, answerWith } = setUp();

    const reviewing = codeTrust.confirm(session.history.document.getState());
    await answerWith("review");
    expect(await reviewing).toEqual({ go: false });
    expect(review).toHaveBeenCalledWith({ kind: "code", part: "js", text: "go()" });

    const closing = codeTrust.confirm(session.history.document.getState());
    await answerWith("cancel");
    expect(await closing).toEqual({ go: false });
  });

  it("stops, and says so, when trusting fails", async () => {
    const { codeTrust, session, api, notify, answerWith } = setUp();
    api.trust.mockResolvedValueOnce({ status: "failed", reason: "unknown" });

    const deciding = codeTrust.confirm(session.history.document.getState());
    await answerWith("keep");

    expect(await deciding).toEqual({ go: false });
    expect(notify).toHaveBeenCalledWith("trust-failed");
  });

  it("trusts code the owner writes here, but not code a paste or an Undo brings", async () => {
    const { session, api } = setUp(starterSite());

    session.edit("props", "Changed Custom Code", (draft) => {
      draft.code.js = "mine()";
    });
    await vi.waitFor(() => expect(api.trust).toHaveBeenCalledWith(SESSION, ["mine()"]));

    api.trust.mockClear();
    session.edit("insert", "Pasted Custom Code", (draft) => {
      const page = draft.pages[draft.homePageId];
      page?.doc.content.push(skimmer);
    });
    session.history.undo();
    session.history.undo();
    session.history.redo();
    await Promise.resolve();
    expect(api.trust).not.toHaveBeenCalled();
    expect(currentPage(session)?.doc.content).not.toContainEqual(skimmer);
  });

  it("follows whether the site's allowed addresses are confirmed, for Site Check", async () => {
    const { codeTrust, session, kept } = setUp(siteWithCode());
    await Promise.resolve();
    expect(codeTrust.allowListConfirmed.getState()).toBe(false);

    kept.add("https://cdn.example.com/\nhttps://fonts.example.com/");
    vi.useFakeTimers();
    try {
      session.edit("insert", "Imported settings", (draft) => {
        draft.settings.allowedExternalUrls.push("https://fonts.example.com/");
      });
      await vi.advanceTimersByTimeAsync(400);
    } finally {
      vi.useRealTimers();
    }
    await vi.waitFor(() => expect(codeTrust.allowListConfirmed.getState()).toBe(true));
    codeTrust.dispose();
  });
});
