import { describe, expect, it } from "vitest";
import { EDITOR_AREAS, WINDOW_AREAS } from "../areas.js";
import { type Area, connectAreas } from "./areas.js";
import { checkServices, defineService, provide, type ServiceUse } from "./services.js";

/** A context of the tests' own: a log, and the services. */
type Log = { readonly log: string[] } & ServiceUse;

const Year = defineService<number>("year");
const Label = defineService<string>("label");

describe("connectAreas (2.20, B1)", () => {
  it("registers the areas in order, and removes them in the opposite order", () => {
    const log: string[] = [];
    const area = (id: string): Area<Log> => ({
      id,
      register: (ctx) => {
        ctx.log.push(`register ${id}`);
        return () => ctx.log.push(`remove ${id}`);
      },
    });

    const remove = connectAreas([area("a"), area("b")], { log });
    remove();

    expect(log).toEqual(["register a", "register b", "remove b", "remove a"]);
  });
});

describe("connectAreas' services (#984)", () => {
  const provider: Area<Log> = {
    id: "provider",
    provides: [provide(Year, () => 2026)],
    register: () => () => undefined,
  };
  const user = (uses: Area<Log>["uses"] = [Year]): Area<Log> => ({
    id: "user",
    ...(uses === undefined ? {} : { uses }),
    register: ({ log, use }) => {
      log.push(`year ${use(Year)}`);
      return () => undefined;
    },
  });

  it("makes each service before any area registers, wherever its provider is listed", () => {
    const log: string[] = [];
    const labelled: Area<Log> = {
      id: "labelled",
      uses: [Year],
      provides: [provide(Label, ({ use }: Log) => `since ${use(Year)}`)],
      register: ({ log: lines, use }) => {
        lines.push(use(Label));
        return () => undefined;
      },
    };

    connectAreas([user(), labelled, provider], { log });

    expect(log).toEqual(["year 2026", "since 2026"]);
  });

  it("fails before any area registers when no area provides a service used", () => {
    const log: string[] = [];

    expect(() => connectAreas([user(), { ...provider, provides: [] }], { log })).toThrow(
      'user uses "year", which no area provides',
    );
    expect(log).toEqual([]);
  });

  it("fails when two areas provide the same service", () => {
    expect(() => connectAreas([provider, { ...provider, id: "other" }], { log: [] })).toThrow(
      '"year" is provided by both provider and other',
    );
  });

  it("fails when services use each other in a cycle", () => {
    const year: Area<Log> = {
      id: "year",
      uses: [Label],
      provides: [provide(Year, ({ use }: Log) => use(Label).length)],
      register: () => () => undefined,
    };
    const label: Area<Log> = {
      id: "label",
      uses: [Year],
      provides: [provide(Label, ({ use }: Log) => String(use(Year)))],
      register: () => () => undefined,
    };

    expect(() => connectAreas([year, label], { log: [] })).toThrow(/cycle: year → label → year/);
  });

  it("gives an area only the services it lists", () => {
    expect(() => connectAreas([provider, user([])], { log: [] })).toThrow(
      'user uses "year" without listing it in its uses',
    );
  });
});

describe("the composition root (2.20, B1)", () => {
  it("provides every service an area uses, once (#984)", () => {
    expect(() => checkServices(WINDOW_AREAS)).not.toThrow();
    expect(() => checkServices(EDITOR_AREAS)).not.toThrow();
  });

  it("names each area once", () => {
    const ids = [...EDITOR_AREAS, ...WINDOW_AREAS].map((area) => area.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers the Edit menu's commands in their order: Cut first, Select similar last", () => {
    // The Edit menu lists commands as they register (1.25, 1.37, 1.29, 1.30).
    const ids = EDITOR_AREAS.map((area) => area.id);

    expect(ids.indexOf("clipboardCommands")).toBeLessThan(ids.indexOf("styleCommands"));
    expect(ids.indexOf("styleCommands")).toBeLessThan(ids.indexOf("canvasCommands"));
    expect(ids.indexOf("canvasCommands")).toBeLessThan(ids.indexOf("sharedSectionCommands"));
    expect(ids.indexOf("sharedSectionCommands")).toBeLessThan(ids.indexOf("elementCommands"));
  });
});
