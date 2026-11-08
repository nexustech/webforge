import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn.js";
import { type CardPlace, placeCard, type ScreenBox } from "./place-card.js";

/** Props of {@link TourCard}. */
export type TourCardProps = Omit<ComponentProps<"section">, "title"> & {
  /** Its heading, which also names it. */
  readonly title: string;
  /** Where it is in the tour ("Step 1 of 3"), if it's a step of one. */
  readonly step?: string | undefined;
  /**
   * What it points at, read as the card draws each frame so it follows it (a heading on the page,
   * a button); centred without one, or while that isn't on screen.
   */
  readonly anchor?: (() => ScreenBox | null) | undefined;
  /** Its buttons, the main one last. */
  readonly actions: ReactNode;
  /** Esc in the card: skips the tour, or answers *Not now*. */
  readonly onEscape: () => void;
  /**
   * Which card it is: a new one takes the focus again if the last one had it (Next, Back), but
   * not from the editor, where the person may be typing.
   */
  readonly focusKey?: string | undefined;
  /**
   * Whether it takes the focus as it opens: the tour, which the person asked for or is offered, does;
   * a tip, shown as the person works (they may be about to type), doesn't, and is announced instead.
   */
  readonly takeFocus?: boolean | undefined;
};

/** Where `anchor` is now and the card's size, as the place the card should be. */
function placeNow(card: HTMLElement, anchor: TourCardProps["anchor"]): CardPlace {
  const view = card.ownerDocument.defaultView;
  return placeCard(
    anchor?.() ?? null,
    { width: card.offsetWidth, height: card.offsetHeight },
    { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
  );
}

/**
 * A card of the tour (OB-3, 5.4a), beside the control it's about, or centred. It never blocks the
 * editor: a labelled region, not a dialog, that takes the focus as it opens but doesn't keep it,
 * so Tab and F6 reach the editor and the person can do what it says. Esc in it calls `onEscape`.
 */
export function TourCard({
  title,
  step,
  anchor,
  actions,
  onEscape,
  focusKey,
  takeFocus = true,
  children,
  className,
  onKeyDown,
  style,
  ...props
}: TourCardProps) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const [place, setPlace] = useState<CardPlace | null>(null);
  // The card that last took the focus; null until the first has.
  const shownKey = useRef<string | null>(null);

  // Follows what it points at, which can move (the page scrolls, a panel is resized). Placed before
  // it's drawn: a state set in a layout effect is drawn with it, so a card moved on to the next step
  // is never shown, or focused, at the last step's place for a frame, as it was in a passive effect
  // (#808).
  useLayoutEffect(() => {
    const card = ref.current;
    const view = card?.ownerDocument.defaultView;
    if (card === null || view === null || view === undefined) return;
    let frame = 0;
    const follow = () => {
      const next = placeNow(card, anchor);
      setPlace((last) =>
        last !== null &&
        last.side === next.side &&
        Math.abs(last.left - next.left) < 0.5 &&
        Math.abs(last.top - next.top) < 0.5
          ? last
          : next,
      );
      frame = view.requestAnimationFrame(follow);
    };
    follow();
    return () => view.cancelAnimationFrame(frame);
  }, [anchor]);

  // The focus as it opens, and again for a new card if the last one had it: once it's placed, as
  // a card still hidden can't take it.
  const placed = place !== null;
  useEffect(() => {
    const card = ref.current;
    const key = focusKey ?? "";
    if (card === null || !placed || shownKey.current === key) return;
    const first = shownKey.current === null;
    shownKey.current = key;
    const active = card.ownerDocument.activeElement;
    const ours = active === null || active === card.ownerDocument.body || card.contains(active);
    if ((first && takeFocus) || (!first && ours)) card.focus({ preventScroll: true });
  }, [focusKey, placed, takeFocus]);

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-slot="tour-card"
      // Not taking the focus, it's read out as it appears.
      aria-live={takeFocus ? undefined : "polite"}
      data-side={place?.side}
      className={cn(
        "fixed z-40 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-lg border",
        "border-primary bg-popover p-4 text-popover-foreground shadow-xl outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      // Placed once measured; until then it's drawn where it will be, unseen.
      style={{
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        visibility: place === null ? "hidden" : undefined,
        ...style,
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // Whatever else saw the key first: a dialog closing as the card took the focus may have
        // marked it handled, and Esc in the card is the card's.
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onEscape();
      }}
      {...props}
    >
      {step === undefined ? null : <p className="m-0 text-xs text-muted-foreground">{step}</p>}
      <h2 id={titleId} className="m-0 text-base font-semibold">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </section>
  );
}
