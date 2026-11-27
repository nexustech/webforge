import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeptCopyInfo, SaveKeptCopyResult } from "../../shared/ipc/project.js";
import type { WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { keptCopyArea } from "./kept-copy.js";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("@webforge/editor-ui", () => ({ toast }));
vi.mock("../storage/index.js", () => ({ siteSession: () => "opening-1" }));

beforeEach(() => vi.clearAllMocks());

const KEPT: KeptCopyInfo = {
  status: "kept",
  first: "0.1.0",
  last: "0.3.1",
  keptAt: "2026-11-27T10:00:00.000Z",
  size: 4,
};

/** The area registered against an API whose open site has `kept`, and its copy-kept event. */
function registered(kept: KeptCopyInfo, saved: SaveKeptCopyResult = { status: "canceled" }) {
  const commands = createCommandRegistry();
  let copyKept: () => void = () => undefined;
  const api = {
    project: {
      keptCopy: vi.fn(async () => kept),
      saveKeptCopy: vi.fn(async () => saved),
    },
    app: {
      onCopyKept: (listener: () => void) => {
        copyKept = listener;
        return () => undefined;
      },
    },
  };
  const dispose = keptCopyArea.register({ api, commands } as unknown as WindowContext);
  const offered = () => commands.list().find((command) => command.id === COMMAND_IDS.saveKeptCopy);
  return { api, commands, dispose, offered, copyKept: () => copyKept() };
}

describe("File › Save the Copy from Before the Update… (#1525)", () => {
  it("isn't offered for a site without a copy", async () => {
    const { api, offered } = registered({ status: "none" });

    await vi.waitFor(() => expect(api.project.keptCopy).toHaveBeenCalledWith("opening-1"));
    expect(offered()).toBeUndefined();
  });

  it("is in the File menu, without a toast, for a site opened with one already", async () => {
    const { offered } = registered(KEPT);

    await vi.waitFor(() =>
      expect(offered()).toMatchObject({
        label: "Save the Copy from Before the Update…",
        menu: "file",
      }),
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it("is offered in a toast once a copy is kept, which saves it", async () => {
    const { api, copyKept, offered } = registered(KEPT, {
      status: "saved",
      fileName: "Bakery (for Webforge 0.1.0 to 0.3.1).wforge",
    });
    await vi.waitFor(() => expect(offered()).toBeDefined());

    copyKept();
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        "Webforge kept a copy of this site as it was, for Webforge 0.1.0 to 0.3.1.",
        expect.objectContaining({ action: expect.objectContaining({ label: "Save…" }) }),
      ),
    );
    const [, options] = toast.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    await vi.waitFor(() => expect(api.project.saveKeptCopy).toHaveBeenCalledWith("opening-1"));
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Saved Bakery (for Webforge 0.1.0 to 0.3.1).wforge",
        expect.anything(),
      ),
    );
  });

  it("names the one release a copy opens in, or none when no release does", async () => {
    const one = registered({ ...KEPT, first: "0.3.1", last: "0.3.1" });
    await vi.waitFor(() => expect(one.offered()).toBeDefined());
    one.copyKept();
    await vi.waitFor(() =>
      expect(toast).toHaveBeenLastCalledWith(
        "Webforge kept a copy of this site as it was, for Webforge 0.3.1.",
        expect.anything(),
      ),
    );

    const unnamed = registered({ ...KEPT, first: null, last: null });
    await vi.waitFor(() => expect(unnamed.offered()).toBeDefined());
    unnamed.copyKept();
    await vi.waitFor(() =>
      expect(toast).toHaveBeenLastCalledWith(
        "Webforge kept a copy of this site as it was before the update.",
        expect.anything(),
      ),
    );
  });

  it("leaves the File menu when the area is removed", async () => {
    const { dispose, offered } = registered(KEPT);
    await vi.waitFor(() => expect(offered()).toBeDefined());

    dispose?.();

    expect(offered()).toBeUndefined();
  });
});
