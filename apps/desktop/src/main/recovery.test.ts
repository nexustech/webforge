import { describe, expect, it, vi } from "vitest";
import type { ProjectResult } from "../shared/ipc-contract.js";
import type { BackupInfo } from "./backups.js";
import { openOrRecover, type RecoveryDialogs, recoveryMessage } from "./recovery.js";

const opened: ProjectResult = {
  status: "opened",
  project: {
    sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
    name: "Bakery",
    fileName: "Bakery.wforge",
    formatVersion: 1,
    syncService: null,
  },
};
const corrupt: ProjectResult = { status: "failed", reason: "corrupt" };
const latest: BackupInfo = {
  path: "/backups/p/20261020-160000-000.wforge",
  takenAt: new Date("2026-10-20T16:00:00Z"),
};
const older: BackupInfo = {
  path: "/backups/p/20261020-153000-000.wforge",
  takenAt: new Date("2026-10-20T15:30:00Z"),
};

function setUp(
  results: ProjectResult[],
  available: BackupInfo[],
  dialogs: Partial<RecoveryDialogs>,
) {
  const session = { open: vi.fn(async () => results.shift() ?? opened) };
  const backups = { list: vi.fn(() => available), restore: vi.fn(() => "/sites/damaged.wforge") };
  const all: RecoveryDialogs = {
    ask: vi.fn(async () => "cancel" as const),
    chooseBackup: vi.fn(async () => undefined),
    noBackups: vi.fn(async () => undefined),
    ...dialogs,
  };
  const run = () => openOrRecover(session, "/sites/Bakery.wforge", backups, all);
  return { session, backups, dialogs: all, run };
}

describe("openOrRecover", () => {
  it("opens a healthy site without asking anything", async () => {
    const { run, dialogs, backups } = setUp([opened], [latest], {});

    await expect(run()).resolves.toEqual(opened);
    expect(dialogs.ask).not.toHaveBeenCalled();
    expect(backups.list).not.toHaveBeenCalled();
  });

  it("passes other failures through", async () => {
    const { run, dialogs } = setUp([{ status: "failed", reason: "newer-format" }], [latest], {});

    await expect(run()).resolves.toEqual({ status: "failed", reason: "newer-format" });
    expect(dialogs.ask).not.toHaveBeenCalled();
  });

  it("offers backups for a file whose header was torn off, if it has any", async () => {
    const notASite: ProjectResult = { status: "failed", reason: "not-a-project" };
    const torn = setUp([notASite, opened], [latest], { ask: vi.fn(async () => "latest" as const) });
    await expect(torn.run()).resolves.toEqual(opened);
    expect(torn.backups.restore).toHaveBeenCalledWith(latest.path, "/sites/Bakery.wforge");

    // Any other file that isn't a site: no backups, so just the usual failure, no message.
    const other = setUp([notASite], [], {});
    await expect(other.run()).resolves.toEqual(notASite);
    expect(other.dialogs.noBackups).not.toHaveBeenCalled();
  });

  it("restores the latest backup of a damaged site and opens it", async () => {
    const { run, backups, session, dialogs } = setUp([corrupt, opened], [latest, older], {
      ask: vi.fn(async () => "latest" as const),
    });

    await expect(run()).resolves.toEqual(opened);
    expect(dialogs.ask).toHaveBeenCalledWith([latest, older]);
    expect(backups.restore).toHaveBeenCalledWith(latest.path, "/sites/Bakery.wforge");
    expect(session.open).toHaveBeenCalledTimes(2);
  });

  it("restores a backup the user picks, but only one of this site's backups", async () => {
    const pick = setUp([corrupt, opened], [latest, older], {
      ask: vi.fn(async () => "choose" as const),
      chooseBackup: vi.fn(async () => older.path),
    });
    await expect(pick.run()).resolves.toEqual(opened);
    expect(pick.dialogs.chooseBackup).toHaveBeenCalledWith("/backups/p");
    expect(pick.backups.restore).toHaveBeenCalledWith(older.path, "/sites/Bakery.wforge");

    const stranger = setUp([corrupt], [latest], {
      ask: vi.fn(async () => "choose" as const),
      chooseBackup: vi.fn(async () => "/somewhere/else.wforge"),
    });
    await expect(stranger.run()).resolves.toEqual(corrupt);
    expect(stranger.backups.restore).not.toHaveBeenCalled();
  });

  it("leaves the damaged site alone when the user cancels", async () => {
    for (const dialogs of [
      { ask: vi.fn(async () => "cancel" as const) },
      { ask: vi.fn(async () => "choose" as const), chooseBackup: vi.fn(async () => undefined) },
    ]) {
      const { run, backups } = setUp([corrupt], [latest], dialogs);

      await expect(run()).resolves.toEqual(corrupt);
      expect(backups.restore).not.toHaveBeenCalled();
    }
  });

  it("says so when a damaged site has no backup yet", async () => {
    const { run, dialogs } = setUp([corrupt], [], {});

    await expect(run()).resolves.toEqual(corrupt);
    expect(dialogs.noBackups).toHaveBeenCalled();
    expect(dialogs.ask).not.toHaveBeenCalled();
  });
});

describe("recoveryMessage", () => {
  it("names the latest backup's time and offers restore, choose and cancel", () => {
    const message = recoveryMessage(latest, "en-GB");

    expect(message.detail).toContain("20 Oct 2026");
    expect(message.buttons).toEqual(["Restore latest backup", "Choose a backup…", "Cancel"]);
    expect(message.title).toBe("Site file damaged");
  });
});
