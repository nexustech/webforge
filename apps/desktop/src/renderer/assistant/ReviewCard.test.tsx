// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewCard } from "./ReviewCard.js";
import type { ReplyUndo } from "./reply-undo.js";

afterEach(cleanup);

const STEPS = [
  {
    entryId: "e1",
    label: "AI (Assistant): Edited Hero title",
    target: { pageId: "home", nodeId: "hero" },
  },
  { entryId: "e2", label: "AI (Assistant): Changed theme colour" },
];

function shown(undo: ReplyUndo, links: { host: string; href: string }[] = []) {
  const handlers = {
    onKeep: vi.fn(),
    onUndo: vi.fn(),
    onOpenVersions: vi.fn(),
    onShowStep: vi.fn(),
  };
  render(<ReviewCard steps={STEPS} links={links} undo={undo} {...handlers} />);
  return {
    ...handlers,
    card: within(screen.getByRole("region", { name: "This reply made 2 changes" })),
  };
}

describe("ReviewCard (AIA-5, WF-2)", () => {
  it("lists the reply's changes, shows one on the page, and keeps or undoes them all", async () => {
    const { card, onShowStep, onUndo, onKeep } = shown({ kind: "undo", to: "e0" });

    await userEvent.click(card.getByRole("button", { name: "Edited Hero title" }));
    expect(onShowStep).toHaveBeenCalledWith(STEPS[0]);
    // A site-wide change has nowhere to show.
    expect(card.queryByRole("button", { name: "Changed theme colour" })).toBeNull();
    expect(card.getByText("Changed theme colour")).toBeDefined();

    await userEvent.click(card.getByRole("button", { name: "Undo These Changes" }));
    expect(onUndo).toHaveBeenCalledOnce();
    await userEvent.click(card.getByRole("button", { name: "Keep" }));
    expect(onKeep).toHaveBeenCalledOnce();
  });

  it("names each link to another website by its host, beside its address (S18)", () => {
    const { card } = shown({ kind: "undo", to: null }, [
      { host: "paypa1.example", href: "https://paypa1.example/pay" },
    ]);

    expect(card.getByText("paypa1.example").tagName).toBe("STRONG");
    expect(card.getByText("https://paypa1.example/pay")).toBeDefined();
  });

  it("offers the version saved before the changes once something has happened since", async () => {
    const { card, onOpenVersions } = shown({ kind: "moved-on" });

    expect(card.queryByRole("button", { name: "Undo These Changes" })).toBeNull();
    expect(card.getByText(/restore the version saved before its changes/)).toBeDefined();
    await userEvent.click(card.getByRole("button", { name: "Open Version History" }));
    expect(onOpenVersions).toHaveBeenCalledOnce();
  });

  it("says when the changes are already undone, with nothing more to do", () => {
    const { card } = shown({ kind: "undone" });

    expect(card.getByRole("status").textContent).toMatch(/These changes are undone/);
    expect(card.queryAllByRole("button", { name: /Keep|Undo/ })).toHaveLength(0);
  });
});
