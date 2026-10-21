// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectResult, RecentSite } from "../../shared/ipc-contract.js";
import { StartScreen } from "./StartScreen.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const info = { name: "Webforge", version: "1.0.0" };
const project = { name: "Bakery", fileName: "Bakery.wforge", formatVersion: 1, syncService: null };
const bakery: RecentSite = {
  id: "a".repeat(32),
  name: "Rosa's Bakery",
  fileName: "Rosa's Bakery.wforge",
  lastOpened: "2026-10-20T09:00:00.000Z",
  lastEdited: "2026-10-21T09:30:00.000Z",
  thumbnail: "data:image/jpeg;base64,/9j/",
  missing: false,
};
const florist: RecentSite = {
  ...bakery,
  id: "b".repeat(32),
  name: "Florist",
  fileName: "Florist.wforge",
  lastEdited: null,
  thumbnail: null,
};
const gone: RecentSite = { ...florist, id: "c".repeat(32), name: "Old site", missing: true };

let container: HTMLDivElement;
let root: Root;
let flushRequests: ReturnType<typeof vi.fn<(save: () => Promise<void>) => () => void>>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  flushRequests = vi.fn((_save: () => Promise<void>) => () => undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function api(recent: RecentSite[], result: ProjectResult = { status: "opened", project }) {
  return {
    create: vi.fn(async () => result),
    open: vi.fn(async () => result),
    listRecent: vi.fn(async () => recent),
    openRecent: vi.fn(async (_id: string) => result),
    removeRecent: vi.fn(async (_id: string) => null),
  };
}

async function render(project: ReturnType<typeof api>, restart = vi.fn()) {
  await act(async () =>
    root.render(
      <StartScreen
        info={info}
        project={project}
        app={{ onFlushRequest: flushRequests }}
        restart={restart}
        locale="en-GB"
      />,
    ),
  );
  return restart;
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((element) => element.textContent?.includes(name));

describe("StartScreen", () => {
  it("answers save requests at once, having nothing to save", async () => {
    await render(api([]));

    const save = flushRequests.mock.calls[0]?.[0];
    await expect(save?.()).resolves.toBeUndefined();
  });

  it("offers a blank site and Open, and says when there are no recent sites", async () => {
    const project = api([]);
    const restart = await render(project);

    expect(container.textContent).toContain("Start a site");
    expect(container.textContent).toContain("Sites you open or create appear here.");
    await act(async () => button("Blank site")?.click());
    expect(project.create).toHaveBeenCalled();
    expect(restart).toHaveBeenCalled();
    await act(async () => button("Open a site…")?.click());
    expect(project.open).toHaveBeenCalled();
  });

  it("lists recent sites with thumbnail, file name and when they were edited or opened", async () => {
    await render(api([bakery, florist, gone]));

    const items = [...container.querySelectorAll("li")].map((item) => item.textContent);
    expect(items[0]).toContain("Rosa's Bakery");
    expect(items[0]).toContain("Edited 21 Oct 2026");
    expect(items[0]).toContain("Rosa's Bakery.wforge");
    expect(items[1]).toContain("Opened 20 Oct 2026");
    expect(items[2]).toContain("The file has been moved or deleted");
    expect(container.querySelector("li img")?.getAttribute("src")).toBe(bakery.thumbnail);
    expect(button("Old site")?.disabled).toBe(true);
  });

  it("opens a recent site and removes one from the list", async () => {
    const project = api([bakery, florist]);
    const restart = await render(project);

    await act(async () => button("Rosa's Bakery")?.click());
    expect(project.openRecent).toHaveBeenCalledWith(bakery.id);
    expect(restart).toHaveBeenCalled();

    const remove = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Florist from the list"]',
    );
    await act(async () => remove?.click());
    expect(project.removeRecent).toHaveBeenCalledWith(florist.id);
    expect(container.textContent).not.toContain("Florist.wforge");
  });

  it("says why a site couldn't be opened", async () => {
    await render(api([bakery], { status: "failed", reason: "newer-format" }));

    await act(async () => button("Rosa's Bakery")?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This site was saved by a newer version of Webforge. Update Webforge to open it.",
    );
  });
});
