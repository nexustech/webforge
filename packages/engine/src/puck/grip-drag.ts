/** What {@link startGripDrag} needs: the grip pressed, the press, and what to do as it moves and ends. */
export type GripDragOptions = {
  /** The grip the person pressed, which takes the pointer until the drag ends. */
  readonly grip: HTMLElement;
  /** The press that starts the drag. */
  readonly pointerId: number;
  /** The canvas's window: Esc is heard there and in the editor's window around it. */
  readonly frame: Window;
  /** Each move of the pointer while the drag goes on. */
  readonly onMove: (moved: PointerEvent) => void;
  /** The pointer let go: the drag's value stays. Called once its listeners are gone. */
  readonly onCommit: () => void;
  /**
   * The drag cancelled, by Esc, by the browser (`pointercancel`) or by the function this returns:
   * the value goes back. Called once its listeners are gone.
   */
  readonly onCancel: () => void;
};

/**
 * Starts dragging a grip on the canvas (2.16, 2.17): a spacing or width handle. The grip takes the
 * pointer; each move goes to `onMove`; letting go commits, and Esc (with Shift or Ctrl held too)
 * or the browser cancels. Esc is heard before anything else, in the canvas and the editor around
 * it, wherever the focus is, and nothing else sees it. Returns what cancels the drag, for a grip
 * that goes away mid-drag: it leaves no listeners behind.
 */
export function startGripDrag(options: GripDragOptions): () => void {
  const { grip, pointerId, frame, onMove, onCommit, onCancel } = options;
  const windows = [frame, frame.parent].filter(
    (each, index, all): each is Window => each !== null && all.indexOf(each) === index,
  );
  let done = false;
  const stop = (): boolean => {
    if (done) return false;
    done = true;
    grip.removeEventListener("pointermove", onMove);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("pointercancel", cancel);
    for (const each of windows) each.removeEventListener("keydown", onKey, true);
    if (grip.hasPointerCapture(pointerId)) grip.releasePointerCapture(pointerId);
    return true;
  };
  function end() {
    if (stop()) onCommit();
  }
  function cancel() {
    if (stop()) onCancel();
  }
  function onKey(pressed: KeyboardEvent) {
    if (pressed.key !== "Escape") return;
    pressed.preventDefault();
    pressed.stopImmediatePropagation();
    cancel();
  }
  grip.setPointerCapture(pointerId);
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", cancel);
  for (const each of windows) each.addEventListener("keydown", onKey, true);
  return cancel;
}
