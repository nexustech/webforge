import type { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBackupSchedule } from "./backup-schedule.js";
import type { SiteStoreAccess } from "./project-session.js";

const store = { info: { projectId: "p" } } as unknown as ProjectStore;
/** The store as the session hands it on: through the gate (R13b). */
const access: SiteStoreAccess = async (work) => work(store);
const HALF_HOUR = 30 * 60 * 1_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createBackupSchedule", () => {
  it("backs up when a site opens, then every 30 minutes only if it was saved", async () => {
    const take = vi.fn(async () => ({ path: "b", takenAt: new Date() }));
    const schedule = createBackupSchedule({ take });

    await schedule.opened(access, "/sites/a.wforge");
    expect(take).toHaveBeenCalledWith(store, "/sites/a.wforge");

    await vi.advanceTimersByTimeAsync(HALF_HOUR);
    expect(take).toHaveBeenCalledTimes(1);

    schedule.committed();
    await vi.advanceTimersByTimeAsync(HALF_HOUR);
    expect(take).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(HALF_HOUR);
    expect(take).toHaveBeenCalledTimes(2);
  });

  it("stops when the site closes, and follows the next site opened", async () => {
    const take = vi.fn(async () => ({ path: "b", takenAt: new Date() }));
    const schedule = createBackupSchedule({ take });
    await schedule.opened(access, "/sites/a.wforge");

    schedule.closed();
    schedule.committed();
    await vi.advanceTimersByTimeAsync(HALF_HOUR);
    expect(take).toHaveBeenCalledTimes(1);

    await schedule.opened(access, "/sites/b.wforge");
    expect(take).toHaveBeenLastCalledWith(store, "/sites/b.wforge");
  });

  it("logs a failed backup by its code only and keeps going", async () => {
    const take = vi.fn(async () => {
      throw Object.assign(new Error("ENOSPC: no space, open 'C:\\Users\\sam\\backups'"), {
        code: "ENOSPC",
      });
    });
    const schedule = createBackupSchedule({ take });

    await expect(schedule.opened(access, "/sites/a.wforge")).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      "Webforge could not back up the site (code=Error ENOSPC)",
    );
  });

  it("does nothing on the timer when no site is open", async () => {
    const take = vi.fn(async () => ({ path: "b", takenAt: new Date() }));
    const schedule = createBackupSchedule({ take }, { intervalMs: 1_000 });
    schedule.committed();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(take).not.toHaveBeenCalled();
  });
});
