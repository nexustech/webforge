import type { SiteDoc, SiteDocumentChange } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitResult } from "../../shared/ipc-contract.js";
import { createEditorSession, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { type Autosave, createAutosave } from "./autosave.js";

const setName = (name: string) => (draft: SiteDoc) => {
  draft.settings.general.name = name;
};

let session: EditorSession;
let commits: SiteDocumentChange[][];
let commit: ReturnType<
  typeof vi.fn<(changes: readonly SiteDocumentChange[]) => Promise<CommitResult>>
>;
let autosave: Autosave;

/** Starts autosave; `saved` is what the file holds, the session's site unless given. */
function start(options: { saved?: SiteDoc | undefined } = {}): void {
  const saved = "saved" in options ? options.saved : session.history.document.getState();
  autosave = createAutosave({ document: session.history.document, saved, commit });
}

/** The content a change puts, for assertions. */
const contentOf = (change: SiteDocumentChange | undefined) =>
  change?.type === "put" ? change.content : undefined;

const edit = (name: string) => session.edit("props", `Changed site name to ${name}`, setName(name));
const status = () => autosave.status.getState().status;

beforeEach(() => {
  vi.useFakeTimers();
  session = createEditorSession(siteLibrary, starterSite());
  commits = [];
  commit = vi.fn(async (changes: readonly SiteDocumentChange[]): Promise<CommitResult> => {
    commits.push([...changes]);
    return { status: "saved" };
  });
});

afterEach(() => {
  autosave.dispose();
  vi.useRealTimers();
});

describe("createAutosave", () => {
  it("starts as saved and saves only the changed documents 2 s after editing pauses", async () => {
    start();
    expect(status()).toBe("saved");

    edit("Rosa's");
    expect(status()).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(1_900);
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);

    expect(commits).toEqual([
      [
        {
          type: "put",
          id: "settings",
          kind: "settings",
          content: session.history.document.getState().settings,
        },
      ],
    ]);
    expect(status()).toBe("saved");
  });

  it("restarts the pause with every change, but saves at least every 30 s", async () => {
    start();

    for (let second = 0; second < 29; second += 1) {
      edit(`Name ${second}`);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(contentOf(commits[0]?.[0])).toMatchObject({ general: { name: "Name 28" } });
  });

  it("saves at once on flush, and does nothing when nothing changed", async () => {
    start();
    await autosave.flush();
    expect(commit).not.toHaveBeenCalled();

    edit("Now");
    await autosave.flush();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(status()).toBe("saved");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("writes every document of a new, empty site straight away", async () => {
    start({ saved: undefined });
    await vi.advanceTimersByTimeAsync(0);

    expect(commits[0]?.map((change) => change.id)).toEqual(
      expect.arrayContaining(["site", "settings", "theme", "layout", "media", "code", "menu"]),
    );
    expect(status()).toBe("saved");
  });

  it("never changes the undo history", async () => {
    start();
    edit("One");
    edit("Two");
    const before = session.history.state.getState();

    await autosave.flush();

    expect(session.history.state.getState()).toBe(before);
    expect(session.history.undo()).toBe(true);
    expect(session.history.document.getState().settings.general.name).toBe("One");
  });

  it("saves again when undo goes back past what was saved", async () => {
    start();
    edit("One");
    await autosave.flush();

    session.history.undo();
    expect(status()).toBe("unsaved");
    await autosave.flush();

    expect(contentOf(commits[1]?.[0])).toMatchObject({ general: { name: "My site" } });
  });

  it("saves changes made during a save in a save of their own", async () => {
    let release: (result: CommitResult) => void = () => undefined;
    commit.mockImplementationOnce(
      (changes) =>
        new Promise((resolve) => {
          commits.push([...changes]);
          release = resolve;
        }),
    );
    start();
    edit("One");
    const first = autosave.flush();
    expect(status()).toBe("saving");

    edit("Two");
    const second = autosave.flush();
    release({ status: "saved" });
    await first;
    await second;

    expect(commits.map((changes) => contentOf(changes[0]))).toEqual([
      expect.objectContaining({ general: expect.objectContaining({ name: "One" }) }),
      expect.objectContaining({ general: expect.objectContaining({ name: "Two" }) }),
    ]);
    expect(status()).toBe("saved");
  });

  it("reports a failed save and tries again on the next flush", async () => {
    commit.mockResolvedValueOnce({ status: "failed", reason: "unknown" });
    commit.mockRejectedValueOnce(new Error("IPC gone"));
    start();
    edit("One");

    await autosave.flush();
    expect(status()).toBe("error");
    edit("Two");
    expect(status()).toBe("error");
    await autosave.flush();
    expect(status()).toBe("error");
    await autosave.flush();

    expect(status()).toBe("saved");
    // Each retry sends everything since the last successful save.
    expect(commit).toHaveBeenCalledTimes(3);
  });

  it("keeps an edit made while a failed save was running unsaved", async () => {
    let release: (result: CommitResult) => void = () => undefined;
    commit.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    start();
    edit("One");
    const saving = autosave.flush();
    edit("Two");
    release({ status: "failed", reason: "unknown" });
    await saving;

    expect(status()).toBe("error");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(status()).toBe("saved");
  });

  it("drops what it was saving, and saves nothing more, once another site has replaced this one (R6)", async () => {
    start();
    commit.mockResolvedValueOnce({ status: "failed", reason: "stale-session" });

    edit("Rosa's");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(commit).toHaveBeenCalledOnce();
    // Neither later edits, nor a flush, nor the 30 s timer send anything to the new site.
    edit("Rosa's Bakery");
    await autosave.flush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(commit).toHaveBeenCalledOnce();
  });

  it("stops saving once disposed", async () => {
    start();
    edit("One");
    autosave.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    await autosave.flush();

    expect(commit).not.toHaveBeenCalled();
  });

  it("ignores the result of a save that finishes after dispose", async () => {
    let release: (result: CommitResult) => void = () => undefined;
    commit.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    start();
    edit("One");
    const saving = autosave.flush();
    autosave.dispose();
    release({ status: "saved" });
    await saving;

    expect(status()).toBe("saving");
  });
});
