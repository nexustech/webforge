import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createEditorSession } from "../editor/editor-session.js";
import { asAssistantStep } from "./assistant-step.js";

afterEach(() => {
  vi.useRealTimers();
});

const KEY = "text:home:text-1:text";

/** A session, and a text edit in the starter text's field, as typing records one. */
function setUp() {
  const session = createEditorSession(siteLibrary, starterSite());
  const type = (name: string) =>
    session.edit(
      "text",
      "Edited Text text",
      (draft) => {
        draft.settings.general.name = name;
      },
      { coalesceKey: KEY, coalesceWindowMs: Number.POSITIVE_INFINITY },
    );
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, type, labels };
}

describe("the assistant's change as one undo step (#873)", () => {
  it("names the next change for the assistant, and keeps later typing out of it", async () => {
    const { session, type, labels } = setUp();
    type("Rise");
    session.history.endSession(KEY);

    asAssistantStep(session.history);
    type("Rise Bakery");
    await Promise.resolve();
    type("Rise Bakery and Café");

    expect(labels()).toEqual([
      "Edited Text text",
      "AI (Assistant): Edited Text text",
      "Edited Text text",
    ]);
    session.history.undo();
    session.history.undo();
    expect(session.history.document.getState().settings.general.name).toBe("Rise");
  });

  it("leaves a change that comes too late alone", () => {
    vi.useFakeTimers();
    const { type, labels, session } = setUp();
    asAssistantStep(session.history);
    vi.advanceTimersByTime(1500);
    type("Rise");
    expect(labels()).toEqual(["Edited Text text"]);
  });
});
