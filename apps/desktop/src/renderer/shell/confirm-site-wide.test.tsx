// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommandRegistry } from "./commands.js";
import {
  createSiteWideConfirm,
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
      "This removes the page and its content. This changes 6 pages. You can undo it afterwards.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete Page" }));

    await expect(answer).resolves.toBe(true);
    expect(before).toHaveBeenCalledWith(deletePage(6));
    expect(screen.queryByRole("alertdialog")).toBeNull();
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
    expect(screen.getByRole("alertdialog").textContent).toContain("This changes 1 page.");
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
});
