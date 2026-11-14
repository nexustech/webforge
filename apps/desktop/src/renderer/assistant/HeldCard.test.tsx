// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeldCard } from "./HeldCard.js";

afterEach(cleanup);

const HELD = [
  { label: "AI (Assistant): Edited Hero title" },
  { label: "AI (Assistant): Added Text to Hero" },
];

describe("the card for a reply's held changes (6.9e, AIA-5)", () => {
  it("lists what would change, with its links by host, and applies or discards them", async () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    render(
      <HeldCard
        held={HELD}
        links={[{ host: "paypa1.example", href: "https://paypa1.example/pay" }]}
        applying={false}
        onApply={onApply}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByRole("region", { name: "2 changes are waiting for you" })).toBeDefined();
    expect(screen.getByText("Nothing on your site has changed yet.")).toBeDefined();
    expect(screen.getByText("Edited Hero title")).toBeDefined();
    expect(screen.getByText("paypa1.example")).toBeDefined();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button", { name: "Apply Changes" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("can't be applied twice while applying", () => {
    render(<HeldCard held={HELD} links={[]} applying onApply={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Applying…" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Discard" }).hasAttribute("disabled")).toBe(true);
  });

  it("says why nothing is waiting any more: discarded, or dropped for a new message", () => {
    const { rerender } = render(
      <HeldCard
        held={[]}
        links={[]}
        outcome="discarded"
        applying={false}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/were discarded/);
    rerender(
      <HeldCard
        held={[]}
        links={[]}
        outcome="replaced"
        applying={false}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/when you sent a new message/);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
