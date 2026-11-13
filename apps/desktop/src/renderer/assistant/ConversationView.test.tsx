// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationView, errorKey, type TurnView } from "./ConversationView.js";

afterEach(cleanup);

const turn = (over: Partial<TurnView> = {}): TurnView => ({
  replyId: "r1",
  message: "Make the Hero's title shorter",
  reply: "Done: it now reads **Fresh bread**.",
  state: "done",
  stop: "end",
  costUsd: 0.0042,
  tools: [],
  ...over,
});

const shown = (turns: TurnView[]) =>
  render(<ConversationView turns={turns} onOpenLink={vi.fn()} afterReply={() => <p>card</p>} />);

describe("ConversationView (6.9c)", () => {
  it("asks for a first message while there are none", () => {
    shown([]);
    expect(screen.getByText(/Ask the assistant to change your site/)).toBeDefined();
  });

  it("shows the message, the reply, its cost and what follows it, once it has ended", () => {
    shown([turn()]);
    const log = within(screen.getByRole("log", { name: "Conversation with the assistant" }));

    expect(log.getByText("Make the Hero's title shorter")).toBeDefined();
    expect(log.getByText("Fresh bread").tagName).toBe("STRONG");
    expect(log.getByText("This reply cost $0.0042")).toBeDefined();
    expect(log.getByText("card")).toBeDefined();
  });

  it("says it is replying before any text, with nothing after it until it ends", () => {
    shown([
      turn({
        state: "replying",
        reply: "",
        costUsd: null,
        tools: [{ callId: "c", state: "running" }],
      }),
    ]);

    expect(screen.getByText("Replying…")).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Working on your site…");
    expect(screen.queryByText("card")).toBeNull();
  });

  it("names its changes without the label's prefix, counts lookups, and says what was refused", () => {
    shown([
      turn({
        tools: [
          { callId: "a", state: "done" },
          { callId: "b", state: "done" },
          {
            callId: "c",
            state: "done",
            step: { entryId: "e1", label: "AI (Assistant): Edited Hero text" },
          },
          { callId: "d", state: "declined" },
        ],
      }),
    ]);

    expect(screen.getByText("Looked at 2 parts of your site")).toBeDefined();
    expect(
      within(screen.getByRole("list", { name: "Changes in this reply" })).getByText(
        "Edited Hero text",
      ),
    ).toBeDefined();
    expect(screen.getByText("You said no to a change.")).toBeDefined();
  });

  it("says why a reply stopped early, and words an error by its code alone", () => {
    shown([
      turn({ replyId: "a", stop: "tool-cap" }),
      turn({ replyId: "b", state: "failed", error: "no-credit", costUsd: null }),
      turn({
        replyId: "c",
        state: "failed",
        error: "Upstream said: <secret prompt>",
        costUsd: null,
      }),
    ]);

    expect(screen.getByText(/at most 25 changes or lookups/)).toBeDefined();
    const alerts = screen.getAllByRole("alert").map((each) => each.textContent);
    expect(alerts).toEqual([
      "Your OpenRouter account has run out of credit.",
      "Something went wrong. Try again.",
    ]);
    expect(errorKey("offline")).toBe("assistant.error.offline");
  });
});
