import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveSiteZipResult } from "../../shared/ipc-contract.js";
import { setFailureLog } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { registerSaveSiteZipCommand } from "./save-site-zip.js";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@webforge/editor-ui", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());

/** File › Save a Copy as ZIP…, answered with `result`, run once to its end. */
async function run(result: () => Promise<SaveSiteZipResult>) {
  const registry = createCommandRegistry();
  const save = vi.fn(result);
  registerSaveSiteZipCommand(registry, save);
  registry.run(COMMAND_IDS.saveSiteZip);
  await vi.waitFor(() => expect(save).toHaveBeenCalled());
  await vi.waitFor(() =>
    expect(registry.list().find((command) => command.id === COMMAND_IDS.saveSiteZip)?.enabled).toBe(
      true,
    ),
  );
  return registry;
}

describe("File › Save a Copy as ZIP… (4.7)", () => {
  it("is in the File menu", () => {
    const registry = createCommandRegistry();
    registerSaveSiteZipCommand(registry, async () => ({ status: "canceled" }));

    expect(registry.list().find((command) => command.id === COMMAND_IDS.saveSiteZip)).toMatchObject(
      { label: "Save a Copy as ZIP…", menu: "file" },
    );
  });

  it("says where the copy is saved, and how it opens again", async () => {
    await run(async () => ({ status: "saved", fileName: "Rosa's Bakery.zip" }));

    expect(toast.success).toHaveBeenCalledWith(
      "Saved a copy of your site as “Rosa's Bakery.zip”.",
      {
        description:
          "It has everything in your site, its versions too. Open it with File › Open Site from ZIP.",
      },
    );
  });

  it("says why no copy was saved, and nothing when the person cancels", async () => {
    await run(async () => ({ status: "failed", reason: "too-large" }));
    expect(toast.error).toHaveBeenLastCalledWith("This site is too large for a ZIP file.");
    await run(async () => ({ status: "failed", reason: "own-file" }));
    expect(toast.error).toHaveBeenLastCalledWith(
      "A copy can't replace your site's own file. Choose another name for it.",
    );
    await run(async () => ({ status: "failed", reason: "unknown" }));
    expect(toast.error).toHaveBeenLastCalledWith("Webforge couldn't save a copy of your site.");

    vi.clearAllMocks();
    await run(async () => ({ status: "canceled" }));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a failed call, says so, and can run again", async () => {
    const failures = vi.fn(async (_context: string, _code: string) => null);
    setFailureLog(failures);
    const registry = await run(async () => {
      throw new Error("IPC down");
    });

    setFailureLog(undefined);
    // Where it failed and the error's name, never its message.
    expect(failures).toHaveBeenCalledWith("site.saveZip", "Error");
    expect(toast.error).toHaveBeenCalledWith("Webforge couldn't save a copy of your site.");
    expect(registry.list().find((command) => command.id === COMMAND_IDS.saveSiteZip)?.enabled).toBe(
      true,
    );
  });
});
