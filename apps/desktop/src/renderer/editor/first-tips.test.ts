import { describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { createFirstTips, whenClosed } from "./first-tips.js";

describe("the first-time tips' places (5.4a, OB-4)", () => {
  it("tells each listener a place was reached, until it stops", () => {
    const tips = createFirstTips();
    const heard = vi.fn();
    const stop = tips.onReached(heard);
    tips.reached("export");
    expect(heard).toHaveBeenCalledWith("export");
    stop();
    tips.reached("mustFix");
    expect(heard).toHaveBeenCalledOnce();
  });

  it("whenClosed: each time a dialog closes, not as it opens or changes while open", () => {
    const dialog = createStore(() => ({ open: false, section: "themes" }));
    const closed = vi.fn();
    const stop = whenClosed(dialog.subscribe, () => dialog.getState().open, closed);
    dialog.setState({ open: true });
    dialog.setState({ section: "fonts" });
    expect(closed).not.toHaveBeenCalled();
    dialog.setState({ open: false });
    expect(closed).toHaveBeenCalledOnce();
    dialog.setState({ section: "themes" });
    dialog.setState({ open: true });
    dialog.setState({ open: false });
    expect(closed).toHaveBeenCalledTimes(2);
    stop();
    dialog.setState({ open: true });
    dialog.setState({ open: false });
    expect(closed).toHaveBeenCalledTimes(2);
  });
});
