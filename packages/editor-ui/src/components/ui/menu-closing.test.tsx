import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnimationEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMenuClosing } from "./menu-closing.js";

afterEach(cleanup);

/** A stand-in for a menu's content, its state set by the test, with a submenu inside it. */
function Content(props: {
  readonly state: "open" | "closed";
  readonly submenuState?: "open" | "closed";
  readonly onAnimationStart?: (event: AnimationEvent<HTMLDivElement>) => void;
  readonly onPointerDownOutside?: (event: Event) => void;
  readonly onFocusOutside?: (event: Event) => void;
  readonly expose: (outside: (event: Event) => void, focus: (event: Event) => void) => void;
}) {
  const closing = useMenuClosing({
    onAnimationStart: props.onAnimationStart,
    onPointerDownOutside: props.onPointerDownOutside,
    onFocusOutside: props.onFocusOutside,
  });
  props.expose(closing.onPointerDownOutside, closing.onFocusOutside);
  return (
    <div data-testid="content" data-state={props.state} onAnimationStart={closing.onAnimationStart}>
      <div data-testid="submenu" data-state={props.submenuState ?? "open"} />
    </div>
  );
}

/** A press: it starts on the document, then the content hears about it as outside. */
function pressOutside(outside: (event: Event) => void): Event {
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  const event = new Event("pointerdownoutside", { cancelable: true });
  outside(event);
  return event;
}

describe("useMenuClosing (#689)", () => {
  it("keeps a press outside from dismissing a menu that is fading out", () => {
    let outside: (event: Event) => void = () => undefined;
    render(<Content state="closed" expose={(each) => (outside = each)} />);
    fireEvent.animationStart(screen.getByTestId("content"));
    expect(pressOutside(outside).defaultPrevented).toBe(true);
  });

  it("lets a press outside an open menu dismiss it, even once the press has redrawn it", () => {
    let outside: (event: Event) => void = () => undefined;
    const { rerender } = render(<Content state="open" expose={(each) => (outside = each)} />);
    fireEvent.animationStart(screen.getByTestId("content"));
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    // Drawn closed before the outside press arrives, as flushSync can: still a press on an open one.
    rerender(<Content state="closed" expose={(each) => (outside = each)} />);
    const event = new Event("pointerdownoutside", { cancelable: true });
    outside(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("goes by the menu's own state, not a submenu's", () => {
    let outside: (event: Event) => void = () => undefined;
    render(<Content state="open" submenuState="closed" expose={(each) => (outside = each)} />);
    fireEvent.animationStart(screen.getByTestId("submenu"));
    expect(pressOutside(outside).defaultPrevented).toBe(false);
  });

  it("keeps the focus outside from dismissing a menu that is fading out, not an open one", () => {
    let focus: (event: Event) => void = () => undefined;
    const { rerender } = render(<Content state="open" expose={(_, each) => (focus = each)} />);
    fireEvent.animationStart(screen.getByTestId("content"));
    const whileOpen = new Event("focusoutside", { cancelable: true });
    focus(whileOpen);
    expect(whileOpen.defaultPrevented).toBe(false);

    rerender(<Content state="closed" expose={(_, each) => (focus = each)} />);
    const whileClosing = new Event("focusoutside", { cancelable: true });
    focus(whileClosing);
    expect(whileClosing.defaultPrevented).toBe(true);
  });

  it("calls the caller's own handlers", () => {
    const animation = vi.fn();
    const own = vi.fn();
    const ownFocus = vi.fn();
    let outside: (event: Event) => void = () => undefined;
    let focus: (event: Event) => void = () => undefined;
    render(
      <Content
        state="open"
        onAnimationStart={animation}
        onPointerDownOutside={own}
        onFocusOutside={ownFocus}
        expose={(press, each) => {
          outside = press;
          focus = each;
        }}
      />,
    );
    fireEvent.animationStart(screen.getByTestId("content"));
    expect(animation).toHaveBeenCalledOnce();
    const event = pressOutside(outside);
    expect(own).toHaveBeenCalledWith(event);
    const moved = new Event("focusoutside", { cancelable: true });
    focus(moved);
    expect(ownFocus).toHaveBeenCalledWith(moved);
  });
});
