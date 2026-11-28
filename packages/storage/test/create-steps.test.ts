import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { type CreateProjectStep, type CreateStepTimer, ProjectStore } from "../src/index.js";

// Making a new project in steps, each wrapped by whoever wants its time (#1560): the opening of a
// site once waited about 5.8 s without working, and these steps say whether the disk was why.

const tempDir = tempDirFactory("webforge-create-steps-");

/** A timer that notes each step as it starts and as it ends, ending it even when it throws. */
function recording() {
  const seen: string[] = [];
  const timed: CreateStepTimer = (step: CreateProjectStep, run) => {
    seen.push(`start ${step}`);
    try {
      return run();
    } finally {
      seen.push(`end ${step}`);
    }
  };
  return { seen, timed };
}

describe("ProjectStore.create's steps (#1560)", () => {
  it("runs each step once, in order, through the timer it's given", () => {
    const { seen, timed } = recording();
    const store = ProjectStore.create(join(tempDir(), "Bakery.wforge"), {
      name: "Bakery",
      timed,
    });
    try {
      expect(seen).toEqual([
        "start make the file",
        "start make the file: open it",
        "end make the file: open it",
        "start make the file: its first write",
        "end make the file: its first write",
        "start make the file: how it writes",
        "end make the file: how it writes",
        "end make the file",
        "start first commit",
        "end first commit",
        "start move into place",
        "end move into place",
        "start check the new file",
        "end check the new file",
      ]);
      expect(store.info.name).toBe("Bakery");
    } finally {
      store.close();
    }
  });

  it("makes the same project without a timer", () => {
    const dir = tempDir();
    const timedStore = ProjectStore.create(join(dir, "Timed.wforge"), {
      name: "Bakery",
      timed: recording().timed,
    });
    const plainStore = ProjectStore.create(join(dir, "Plain.wforge"), { name: "Bakery" });
    try {
      const facts = (store: ProjectStore) => {
        const { projectId: _id, createdAt: _created, ...rest } = store.info;
        return { ...rest, empty: store.isEmpty(), versions: store.listVersions() };
      };
      expect(facts(plainStore)).toEqual(facts(timedStore));
    } finally {
      timedStore.close();
      plainStore.close();
    }
  });

  it("throws as it does untimed when a step fails, the step ended", () => {
    // A folder that isn't there: the new file can't be made.
    const path = join(tempDir(), "missing", "Bakery.wforge");
    const untimed = (() => {
      try {
        ProjectStore.create(path, { name: "Bakery" });
      } catch (error) {
        return error;
      }
      return undefined;
    })();
    const { seen, timed } = recording();

    expect(untimed).toBeInstanceOf(Error);
    expect(() => ProjectStore.create(path, { name: "Bakery", timed })).toThrow(
      (untimed as Error).constructor as new () => Error,
    );
    expect(seen).toEqual([
      "start make the file",
      "start make the file: open it",
      "end make the file: open it",
      "end make the file",
    ]);
  });
});
