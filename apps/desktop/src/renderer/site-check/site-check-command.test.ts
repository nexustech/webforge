import type { CheckLevel, CheckReport, Finding } from "@webforge/site-check";
import { describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { registerSiteCheckCommand, siteCheckStatus } from "./site-check-command.js";

const found = (count: number): Finding[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `k${index}`,
    place: { kind: "address" },
  }));

/** A report with `counts` findings at each level. */
function reportOf(counts: Partial<Record<CheckLevel, number>>): CheckReport {
  return {
    mode: "export",
    results: Object.entries(counts).map(([level, count]) => ({
      rule: level,
      level: level as CheckLevel,
      findings: found(count),
      ignored: 0,
    })),
  };
}

describe("siteCheckStatus", () => {
  const status = (report: CheckReport) => siteCheckStatus(report).status;
  const short = (report: CheckReport) => siteCheckStatus(report).shortStatus;

  it("counts Must fix and Should fix together, then tips (#1009)", () => {
    expect(status(reportOf({ must: 2, should: 3, tip: 13 }))).toBe("5 to fix · 13 tips");
    expect(status(reportOf({ should: 1, tip: 1 }))).toBe("1 to fix · 1 tip");
  });

  it("leaves out a count of none", () => {
    expect(status(reportOf({ must: 1, tip: 0 }))).toBe("1 to fix");
    expect(status(reportOf({ must: 0, should: 0, tip: 4 }))).toBe("4 tips");
  });

  it("says No problems when it found nothing, ignored findings left out", () => {
    expect(status(reportOf({ must: 0, should: 0, tip: 0 }))).toBe("No problems");
    expect(status({ mode: "export", results: [] })).toBe("No problems");
  });

  it("says for a narrow title bar only what most needs doing, in words (#1166)", () => {
    expect(short(reportOf({ must: 2, should: 10, tip: 23 }))).toBe("12 to fix");
    expect(short(reportOf({ must: 0, should: 0, tip: 13 }))).toBe("13 tips");
    expect(short(reportOf({ must: 0, should: 0, tip: 0 }))).toBe("No problems");
  });
});

describe("registerSiteCheckCommand", () => {
  function setUp(report = reportOf({ must: 1 })) {
    const commands = createCommandRegistry();
    const panels = { show: vi.fn() };
    const state = createStore<{ report: CheckReport }>()(() => ({ report }));
    const remove = registerSiteCheckCommand(commands, panels, "siteCheck", state);
    return { commands, panels, state, remove };
  }

  it("opens the panel, showing what the check found (#1009)", () => {
    const { commands, panels } = setUp();

    expect(commands.get(COMMAND_IDS.siteCheck)).toMatchObject({
      label: "Site Check",
      status: "1 to fix",
    });
    expect(commands.run(COMMAND_IDS.siteCheck)).toBe(true);
    expect(panels.show).toHaveBeenCalledWith("siteCheck");
  });

  it("keeps up with each check", () => {
    const { commands, state } = setUp();
    const listener = vi.fn();
    commands.subscribe(listener);

    state.setState({ report: reportOf({ should: 1, tip: 2 }) });
    expect(commands.get(COMMAND_IDS.siteCheck)).toMatchObject({
      status: "1 to fix · 2 tips",
      shortStatus: "1 to fix",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    // The same counts again: nothing for the title bar to draw.
    state.setState({ report: reportOf({ should: 1, tip: 2 }) });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("goes, and stops following the checks, once removed", () => {
    const { commands, state, remove } = setUp();
    remove();

    expect(commands.get(COMMAND_IDS.siteCheck)).toBeUndefined();
    state.setState({ report: reportOf({ tip: 2 }) });
    expect(commands.get(COMMAND_IDS.siteCheck)).toBeUndefined();
  });
});
