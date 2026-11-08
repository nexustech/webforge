import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button.js";
import type { ScreenBox } from "./place-card.js";
import { TourCard } from "./tour-card.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

afterEach(cleanup);

/** The editor, as the card sits beside it. */
function Editor({ step, onEscape }: { readonly step: string; readonly onEscape: () => void }) {
  return (
    <>
      <button type="button">Your page</button>
      <TourCard
        title={step === "one" ? "Change your words" : "See it as visitors will"}
        step={step === "one" ? "Step 1 of 3" : "Step 2 of 3"}
        focusKey={step}
        onEscape={onEscape}
        actions={<Button>Next</Button>}
      >
        <p>Click any text on your page.</p>
      </TourCard>
    </>
  );
}

describe("TourCard (OB-3)", () => {
  it("is a region named by its heading, which takes the focus as it opens", () => {
    render(<Editor step="one" onEscape={vi.fn()} />);
    const card = screen.getByRole("region", { name: "Change your words" });
    expect(document.activeElement).toBe(card);
    expect(card.textContent).toContain("Step 1 of 3");
  });

  it("lets the focus leave for the editor, and Esc in it calls onEscape", async () => {
    const onEscape = vi.fn();
    render(<Editor step="one" onEscape={onEscape} />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));
    // Not trapped: Shift+Tab goes back out to the editor.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Your page" }));
    await user.keyboard("{Escape}");
    expect(onEscape).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Next" }).focus();
    await user.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("leaves the focus where it is with takeFocus off, and is read out instead", () => {
    render(
      <>
        <button type="button">Your page</button>
        <TourCard title="Content mode" takeFocus={false} onEscape={vi.fn()} actions={null}>
          <p>Content mode locks the layout.</p>
        </TourCard>
      </>,
    );
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole("region", { name: "Content mode" }).getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("takes the focus again for the next card only if the last one had it", async () => {
    const { rerender } = render(<Editor step="one" onEscape={vi.fn()} />);
    rerender(<Editor step="two" onEscape={vi.fn()} />);
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "See it as visitors will" }),
    );
    // Typing in the editor when the tour moves on by itself: the focus stays there.
    const page = screen.getByRole("button", { name: "Your page" });
    page.focus();
    await act(async () => {
      rerender(<Editor step="one" onEscape={vi.fn()} />);
    });
    expect(document.activeElement).toBe(page);
  });

  it("is at its new place as soon as it moves on to a step that points elsewhere (#808)", () => {
    // The title bar's Preview button, after a heading on the page.
    const anchors: Readonly<Record<string, ScreenBox>> = {
      one: { left: 300, top: 400, width: 200, height: 40 },
      two: { left: 600, top: 8, width: 32, height: 32 },
    };
    let moveOn: () => void = () => undefined;
    function Tour() {
      const [step, setStep] = useState("one");
      useEffect(() => {
        moveOn = () => setStep("two");
      });
      return (
        <TourCard
          title={step === "one" ? "Change your words" : "See it as visitors will"}
          focusKey={step}
          anchor={() => anchors[step] ?? null}
          onEscape={vi.fn()}
        >
          <p>Click any text on your page.</p>
        </TourCard>
      );
    }
    render(<Tour />);
    const card = screen.getByRole("region", { name: "Change your words" });
    expect(card.style.top).toBe("448px");

    // As Next does: a discrete update, outside act, read straight after with nothing else run.
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      flushSync(() => moveOn());
    } finally {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    }
    expect(card.textContent).toContain("See it as visitors will");
    expect(card.style.top).toBe("48px");
  });
});
