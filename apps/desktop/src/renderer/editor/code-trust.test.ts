import { allowListText, type NodeDoc, type SiteDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrustApi } from "../../shared/ipc/trust.js";
import { starterSite } from "../../shared/starter-site.js";
import { applyLook, lookChange } from "../clipboard/index.js";
import { sessionWith } from "../testing/fixtures.js";
import { toggleSelectedHidden } from "./bulk-layers.js";
import { type CodeAnswer, createCodeTrust } from "./code-trust.js";
import { currentPage, type EditorSession } from "./editor-session.js";
import { setLayerHidden } from "./layers.js";

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

/** The starter site with `node` hidden on the home page, or as the Header's first section. */
function siteHiding(node: NodeDoc, where: "page" | "header" = "page"): SiteDoc {
  const site = starterSite();
  const hidden = { ...node, props: { ...node.props, hidden: true } };
  if (where === "header") return { ...site, layout: { ...site.layout, header: [hidden] } };
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  return {
    ...site,
    pages: {
      ...site.pages,
      [site.homePageId]: { ...home, doc: { ...home.doc, content: [...home.doc.content, hidden] } },
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

/** What each test connected, disconnected after it. */
const connected: (() => void)[] = [];
afterEach(() => {
  for (const disconnect of connected.splice(0)) disconnect();
  vi.useRealTimers();
});

function setUp(site = siteWithCode(), trusted: Iterable<string> = []) {
  const session = sessionWith(site);
  const { api, kept } = fakeTrust(trusted);
  const review = vi.fn();
  const notify = vi.fn();
  const codeTrust = createCodeTrust({ api, session, sessionId: () => SESSION, review, notify });
  connected.push(codeTrust.connect());
  /** Answers the prompt with `answer` once it asks. */
  const answerWith = async (answer: CodeAnswer) => {
    await vi.waitFor(() => expect(codeTrust.question.getState().question).not.toBeNull());
    const asked = codeTrust.question.getState().question;
    asked?.answer(answer);
    return asked?.pieces ?? [];
  };
  /** What the next export would be asked about, answered with Cancel. */
  const asked = async () => {
    const deciding = codeTrust.confirm(session.history.document.getState());
    const pieces = await answerWith("cancel");
    await deciding;
    return pieces.map((piece) => piece.text);
  };
  return { session, api, kept, review, notify, codeTrust, answerWith, asked };
}

/** Writes `text` in Settings' Custom Code part `part`, as its field says it does. */
function write(session: EditorSession, part: "js" | "head" | "bodyEnd", text: string) {
  const before = session.history.document.getState().code[part];
  session.edit("props", "Changed Custom Code", (draft) => {
    draft.code[part] = text;
  });
  session.codeWritten(before, text);
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

  it("follows whether the site's allowed addresses are confirmed, for Site Check", async () => {
    const { codeTrust, session, kept } = setUp(siteWithCode());
    await Promise.resolve();
    expect(codeTrust.allowListConfirmed.getState()).toBe(false);

    kept.add("https://cdn.example.com/\nhttps://fonts.example.com/");
    vi.useFakeTimers();
    session.edit("insert", "Imported settings", (draft) => {
      draft.settings.allowedExternalUrls.push("https://fonts.example.com/");
    });
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    await vi.waitFor(() => expect(codeTrust.allowListConfirmed.getState()).toBe(true));
  });
});

describe("what the owner writes (#649)", () => {
  it("is trusted once they stop, never the steps on the way", async () => {
    const { session, api } = setUp(starterSite());
    vi.useFakeTimers();
    for (const js of ["m", "mi", "mine()"]) write(session, "js", js);
    expect(api.trust).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);

    expect(api.trust).toHaveBeenCalledOnce();
    expect(api.trust).toHaveBeenCalledWith(SESSION, ["mine()"]);
  });

  it("is trusted before an export asks, so it's never asked about", async () => {
    const { session, api, codeTrust } = setUp(starterSite());
    write(session, "js", "mine()");

    expect(await codeTrust.confirm(session.history.document.getState())).toMatchObject({
      go: true,
    });
    expect(api.trust).toHaveBeenCalledWith(SESSION, ["mine()"]);
    expect(codeTrust.question.getState().question).toBeNull();
  });

  it("stays trusted as they change code they trust", async () => {
    const site = starterSite();
    const { session, api } = setUp({ ...site, code: { ...site.code, js: "go()" } }, ["go()"]);
    vi.useFakeTimers();
    for (const js of ["go(1)", "go(12)"]) write(session, "js", js);
    await vi.advanceTimersByTimeAsync(1000);

    expect(api.trust).toHaveBeenCalledWith(SESSION, ["go(12)"]);
  });

  it("leaves code they changed but haven't confirmed to the prompt, whole", async () => {
    const { session, api, asked } = setUp(siteWithCode(), ["<script>skim()</script>"]);
    vi.useFakeTimers();
    // A fix to a line of the file's script, and an address added to its list.
    for (const js of ["go(1)", "go(12)"]) write(session, "js", js);
    const before = allowListText(session.history.document.getState().settings.allowedExternalUrls);
    session.edit("props", "Changed Custom Code", (draft) => {
      draft.settings.allowedExternalUrls.push("https://mine.example.com/");
    });
    session.codeWritten(
      before,
      allowListText(session.history.document.getState().settings.allowedExternalUrls),
    );
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();

    expect(api.trust).not.toHaveBeenCalled();
    expect(await asked()).toEqual([
      "go(12)",
      "https://cdn.example.com/\nhttps://mine.example.com/",
    ]);
  });

  it("isn't followed once the window's areas disconnect", async () => {
    const { session, api } = setUp(starterSite());
    for (const disconnect of connected.splice(0)) disconnect();
    vi.useFakeTimers();
    write(session, "js", "mine()");
    await vi.advanceTimersByTimeAsync(1000);

    expect(api.trust).not.toHaveBeenCalled();
  });
});

describe("what trusts no code (#649)", () => {
  /** After `act`, nothing was trusted, and the next export asks about the skimmer. */
  async function asksAfter(site: SiteDoc, act: (session: EditorSession) => void) {
    const { session, api, asked } = setUp(site);
    vi.useFakeTimers();
    act(session);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();

    expect(api.trust).not.toHaveBeenCalled();
    expect(await asked()).toContain("<script>skim()</script>");
  }

  it("a paste, an Undo and a Redo", async () => {
    await asksAfter(starterSite(), (session) => {
      session.edit("insert", "Pasted Custom Code", (draft) => {
        draft.pages[draft.homePageId]?.doc.content.push(skimmer);
      });
      session.history.undo();
      session.history.redo();
      expect(currentPage(session)?.doc.content).toContainEqual(skimmer);
    });
  });

  it("showing a hidden Custom Code element in Layers", async () => {
    await asksAfter(siteHiding(skimmer), (session) => setLayerHidden(session, "skim", false));
  });

  it("showing several at once", async () => {
    await asksAfter(siteHiding(skimmer), (session) => {
      session.selectElements(["skim"]);
      toggleSelectedHidden(session);
    });
  });

  it("showing the Header with its eye", async () => {
    await asksAfter(siteHiding(skimmer, "header"), (session) =>
      setLayerHidden(session, "skim", false),
    );
  });

  it("Apply Look to Every, which gives the look alone", async () => {
    const site = siteWithCode();
    const mine: NodeDoc = {
      type: "CustomCode",
      props: { id: "mine", code: "<p>Mine</p>", lookOpacity: "50" },
    };
    site.pages[site.homePageId]?.doc.content.push(mine);
    await asksAfter(site, (session) => {
      session.select("mine");
      const change = lookChange(session, "site");
      expect(change?.targets.map((each) => each.node.props.id)).toEqual(["skim"]);
      if (change !== undefined) expect(applyLook(session, change)).toBe(true);
      const skim = currentPage(session)?.doc.content.find((each) => each.props.id === "skim");
      expect(skim?.props).toMatchObject({ code: "<script>skim()</script>", lookOpacity: "50" });
    });
  });
});
