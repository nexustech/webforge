// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "./commands.js";
import {
  createSiteWideConfirm,
  dropHeld,
  historyCommandMindingQuestions,
  pauseCommandsWhileAsking,
  SiteWideConfirmDialog,
} from "./confirm-site-wide.js";

afterEach(cleanup);

const deletePage = (affectedPages: number) => ({
  action: "Delete page 'About'?",
  description: "This removes the page and its content.",
  confirm: "Delete Page",
  affectedPages,
});

describe("Undo and Redo keys around a site-wide question (#1344)", () => {
  /** A confirmation whose hook (the version's saving) waits until `saved` is called. */
  function waitingForVersion() {
    const confirm = createSiteWideConfirm();
    let saved: () => void = () => undefined;
    confirm.setBeforeSiteWideAction(
      () =>
        new Promise<void>((resolve) => {
          saved = resolve;
        }),
    );
    return { confirm, saved: () => saved() };
  }
  /** What each test holds back. */
  let held = new Set<() => void>();
  beforeEach(() => {
    held = new Set();
  });

  it("run at once while nothing is asked or waits", () => {
    const run = vi.fn((_command: string) => true);
    expect(historyCommandMindingQuestions(createSiteWideConfirm(), "undo", run, new Set())).toBe(
      true,
    );
    expect(run).toHaveBeenCalledWith("undo");
  });

  it("do nothing while the question is open: the keys are the dialog's", () => {
    const { confirm } = waitingForVersion();
    void confirm.confirmSiteWide(deletePage(2));
    const run = vi.fn((_command: string) => true);
    expect(historyCommandMindingQuestions(confirm, "undo", run, held)).toBe(false);
    expect(historyCommandMindingQuestions(confirm, "cancel", run, held)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("wait for the answered change, in the order pressed, and come after it", async () => {
    const { confirm, saved } = waitingForVersion();
    const order: string[] = [];
    const change = confirm.confirmSiteWide(deletePage(2)).then(() => order.push("change"));
    confirm.answer(true);
    await Promise.resolve();
    expect(confirm.busy()).toBe(true);

    const run = (command: string) => {
      order.push(command);
      return true;
    };
    // Taken, so nothing else has the keys, but not run yet; Esc has nothing to cancel.
    expect(historyCommandMindingQuestions(confirm, "undo", run, held)).toBe(true);
    expect(historyCommandMindingQuestions(confirm, "redo", run, held)).toBe(true);
    expect(historyCommandMindingQuestions(confirm, "cancel", run, held)).toBe(false);
    expect(order).toEqual([]);

    expect(held.size).toBe(2);

    saved();
    await change;
    await vi.waitFor(() => expect(order).toEqual(["change", "undo", "redo"]));
    // Run, so nothing is held any more.
    expect(held.size).toBe(0);
  });

  it("are dropped, not run, once whoever took them stops listening (#1344 review)", async () => {
    const { confirm, saved } = waitingForVersion();
    const change = confirm.confirmSiteWide(deletePage(2));
    confirm.answer(true);
    await Promise.resolve();
    const run = vi.fn((_command: string) => true);
    expect(historyCommandMindingQuestions(confirm, "undo", run, held)).toBe(true);

    // The editor closes as the version saves: its Undo has nothing left to undo in.
    dropHeld(held);
    expect(held.size).toBe(0);
    saved();
    await change;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(run).not.toHaveBeenCalled();
  });

  it("wait for an unasked change too, and run at once after it", async () => {
    const { confirm, saved } = waitingForVersion();
    const unasked = confirm.beforeUnaskedChange(deletePage(2));
    const run = vi.fn((_command: string) => true);
    expect(historyCommandMindingQuestions(confirm, "undo", run, held)).toBe(true);
    expect(run).not.toHaveBeenCalled();
    saved();
    await unasked;
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith("undo"));
    confirm.afterChange(() => run("redo"));
    expect(run).toHaveBeenLastCalledWith("redo");
  });
});

describe("confirmSiteWide (D7)", () => {
  it("states how many pages change, and runs the hook before the confirmed action", async () => {
    const confirm = createSiteWideConfirm();
    const before = vi.fn();
    confirm.setBeforeSiteWideAction(before);
    render(<SiteWideConfirmDialog confirm={confirm} />);

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = confirm.confirmSiteWide(deletePage(6));
    });
    expect(screen.getByRole("alertdialog", { name: "Delete page 'About'?" }).textContent).toContain(
      "This removes the page and its content. 6 pages of your site will change. You can undo it afterwards.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete Page" }));

    await expect(answer).resolves.toBe(true);
    expect(before).toHaveBeenCalledWith(deletePage(6), { asked: true });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("offers an AI app's question to let it work without asking, by keyboard too (5.35)", async () => {
    const confirm = createSiteWideConfirm();
    render(<SiteWideConfirmDialog confirm={confirm} />);
    const allowAlways = vi.fn();

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = confirm.confirmSiteWide({ ...deletePage(6), allowAlways });
    });
    const offer = screen.getByRole("button", { name: "Allow, and Don't Ask Again for an Hour" });
    offer.focus();
    await userEvent.keyboard("{Enter}");

    await expect(answer).resolves.toBe(true);
    expect(allowAlways).toHaveBeenCalledOnce();

    // A question without it, such as the person's own, offers nothing more.
    act(() => {
      void confirm.confirmSiteWide(deletePage(6));
    });
    expect(
      screen.queryByRole("button", { name: "Allow, and Don't Ask Again for an Hour" }),
    ).toBeNull();
  });

  it("resolves false when cancelled, without the hook; one page is said so", async () => {
    const confirm = createSiteWideConfirm();
    const before = vi.fn();
    confirm.setBeforeSiteWideAction(before);
    render(<SiteWideConfirmDialog confirm={confirm} />);

    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = confirm.confirmSiteWide(deletePage(1));
    });
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "1 page of your site will change.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(answer).resolves.toBe(false);
    expect(before).not.toHaveBeenCalled();
  });

  it("cancels a question still open when another comes, and never lets a failed hook block", async () => {
    const confirm = createSiteWideConfirm();
    const remove = confirm.setBeforeSiteWideAction(() => Promise.reject(new Error("no version")));

    const first = confirm.confirmSiteWide(deletePage(2));
    const second = confirm.confirmSiteWide(deletePage(3));
    expect(confirm.current()?.affectedPages).toBe(3);
    confirm.answer(true);

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    remove();
    remove();
    const third = confirm.confirmSiteWide(deletePage(1));
    confirm.answer(true);
    await expect(third).resolves.toBe(true);
  });

  it("runs the hook before a change that asks no question, which a failed hook never blocks (4.6)", async () => {
    const confirm = createSiteWideConfirm();
    const before = vi.fn();
    const remove = confirm.setBeforeSiteWideAction(before);
    const fonts = { action: "Changed fonts", confirm: "Changed fonts", affectedPages: 4 };

    await confirm.beforeUnaskedChange(fonts);
    expect(before).toHaveBeenCalledWith(fonts, { asked: false });
    expect(confirm.current()).toBeNull();

    remove();
    confirm.setBeforeSiteWideAction(() => {
      throw new Error("no version");
    });
    await expect(confirm.beforeUnaskedChange(fonts)).resolves.toBeUndefined();
  });

  it("pauses the window's commands while it asks, so nothing changes the site meanwhile", () => {
    const confirm = createSiteWideConfirm();
    const registry = createCommandRegistry();
    const undo = vi.fn();
    registry.register({ id: "edit.undo", label: "Undo", run: undo });
    const stop = pauseCommandsWhileAsking(confirm, registry);

    void confirm.confirmSiteWide(deletePage(2));
    expect(registry.run("edit.undo")).toBe(false);
    void confirm.confirmSiteWide(deletePage(3));
    confirm.answer(false);
    expect(registry.run("edit.undo")).toBe(true);

    void confirm.confirmSiteWide(deletePage(2));
    stop();
    expect(registry.run("edit.undo")).toBe(true);
    expect(undo).toHaveBeenCalledTimes(2);
  });

  it("keeps Undo paused until the answered change has its version, so Undo never lands first (4.6)", async () => {
    const confirm = createSiteWideConfirm();
    const registry = createCommandRegistry();
    registry.register({ id: "edit.undo", label: "Undo", run: vi.fn() });
    pauseCommandsWhileAsking(confirm, registry);
    let saved: () => void = () => undefined;
    confirm.setBeforeSiteWideAction(
      () =>
        new Promise<void>((resolve) => {
          saved = resolve;
        }),
    );

    const answer = confirm.confirmSiteWide(deletePage(2));
    confirm.answer(true);
    await Promise.resolve();
    expect(confirm.current()).toBeNull();
    expect(confirm.busy()).toBe(true);
    expect(registry.run("edit.undo")).toBe(false);

    let made = false;
    const change = answer.then(() => {
      made = true;
      // The change is made before Undo works again: nothing pressed meanwhile came first.
      expect(confirm.busy()).toBe(false);
    });
    saved();
    await change;
    expect(made).toBe(true);
    expect(registry.run("edit.undo")).toBe(true);

    // An unasked theme change waits the same way.
    const unasked = confirm.beforeUnaskedChange(deletePage(2));
    expect(confirm.busy()).toBe(true);
    saved();
    await unasked;
    expect(confirm.busy()).toBe(false);
  });
});
