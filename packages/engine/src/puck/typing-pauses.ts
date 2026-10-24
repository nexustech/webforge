/**
 * The pauses in the user's typing on the canvas, timed by the keystrokes themselves (#307). Puck
 * sends rich text on after a debounce, and on a busy computer later still, so when an edit arrives
 * says little about when it was typed: the app splits a typing session into undo chunks by these
 * pauses instead.
 */
export type TypingPauses = {
  /** A key pressed at `at` (ms, any clock that keeps going up). */
  keystroke(at: number): void;
  /**
   * The longest pause, in ms, before or between the keystrokes since the last call: the time from
   * the keystroke before them is counted too (Infinity for the very first). Undefined if no key
   * was pressed since (text pasted from a menu).
   */
  take(): number | undefined;
};

export function typingPauses(): TypingPauses {
  let last: number | null = null;
  let longest: number | undefined;
  return {
    keystroke(at) {
      const pause = last === null ? Number.POSITIVE_INFINITY : Math.max(at - last, 0);
      longest = Math.max(longest ?? 0, pause);
      last = at;
    },
    take() {
      const pause = longest;
      longest = undefined;
      return pause;
    },
  };
}

/**
 * Times every key pressed in `target` (the canvas iframe's window) into `pauses`, by the time the
 * key was pressed, not when the busy page got round to it. Returns the function that stops it.
 */
export function timeKeystrokes(target: Window, pauses: TypingPauses): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    pauses.keystroke(target.performance.timeOrigin + event.timeStamp);
  };
  target.addEventListener("keydown", onKeyDown, { capture: true });
  return () => target.removeEventListener("keydown", onKeyDown, { capture: true });
}
