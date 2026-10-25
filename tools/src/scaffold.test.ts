import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addEntry,
  addImport,
  addImportLine,
  applyEdits,
  folderProblem,
  insertAfter,
  insertBefore,
  listEditorPanel,
  main,
  namesOf,
  planFor,
  registerStrings,
  STRINGS_FILES,
  scaffold,
  stringKeys,
} from "./scaffold.js";

// `pnpm scaffold` (2.20, B7). That what it writes passes `pnpm check` and draws in Storybook was
// checked by running every kind on the repository; these check what it writes, where, and that
// each edit still finds its place in the repository's files.

const REPO = join(import.meta.dirname, "../..");

// The repository's files each kind of scaffold reads and changes. Each test copies only those it
// needs: on a slow runner every file copied and then read for the first time costs time (#403).

/** An area's: the list of areas and the strings' index. */
const AREA = ["apps/desktop/src/renderer/areas.ts", "packages/i18n/src/en.ts"];

/** A panel's: an area's, and the editor's test that lists the panels. */
const PANEL = [...AREA, "apps/desktop/src/renderer/editor/Editor.test.tsx"];

/** The Site area there is, and the strings file it keeps its strings in. */
const SITE = ["apps/desktop/src/renderer/site/area.ts", "packages/i18n/src/en/panels.ts"];

/** The Layers area there is, which keeps its strings in the same file. */
const LAYERS = ["apps/desktop/src/renderer/layers/area.ts", "packages/i18n/src/en/panels.ts"];

/** A kind of field's. */
const FIELD_KIND = [
  "apps/desktop/src/renderer/editor/EditPanelHost.tsx",
  "apps/desktop/src/renderer/fields/field-kinds.ts",
  "apps/desktop/src/renderer/fields/field-renderers.ts",
  "packages/site-components/src/schema.ts",
  "packages/site-components/src/define.ts",
  "packages/engine/src/puck/config.tsx",
  "packages/engine/src/puck/config.test.tsx",
  "packages/editor-ui/src/components/edit/field-spec.ts",
];

/** An IPC domain's. */
const IPC_DOMAIN = [
  "apps/desktop/src/shared/ipc-contract.ts",
  "apps/desktop/src/shared/webforge-api.ts",
  "apps/desktop/src/preload/api.ts",
  "apps/desktop/src/main/app.ts",
];

const temporary: string[] = [];

/** A folder with copies of `files` from the repository, and a folder for the English strings. */
function copyOfRepo(files: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "webforge-scaffold-"));
  temporary.push(root);
  mkdirSync(join(root, "packages/i18n/src/en"), { recursive: true });
  for (const path of files) cpSync(join(REPO, path), join(root, path));
  return root;
}

afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

describe("scaffold's names and folders", () => {
  it("names something after its PascalCase name", () => {
    expect(namesOf("OpeningTimes")).toEqual({
      pascal: "OpeningTimes",
      file: "opening-times",
      camel: "openingTimes",
      label: "Opening times",
    });
  });

  it("refuses a name that isn't PascalCase", () => {
    for (const bad of ["openingTimes", "Opening-Times", "Opening Times", ""]) {
      expect(namesOf(bad), bad).toMatch(/isn't a name/);
    }
  });

  it("takes an area's folder, but not one every area builds on or a badly named one", () => {
    expect(folderProblem("opening-times")).toBeUndefined();
    expect(folderProblem("editor")).toMatch(/what every area builds on/);
    expect(folderProblem("Opening")).toMatch(/isn't a renderer folder/);
    expect(folderProblem("opening--times")).toMatch(/isn't a renderer folder/);
  });
});

describe("scaffold's text edits", () => {
  it("inserts before or after what it finds, and says what it can't find", () => {
    expect(insertBefore("a c", "c", "b ")).toBe("a b c");
    expect(insertAfter("a c", "a", " b")).toBe("a b c");
    expect(() => insertBefore("a", "z", "b")).toThrow('can\'t find "z"');
    expect(() => insertAfter("a", "z", "b")).toThrow('can\'t find "z"');
  });

  it("adds an import to one of the same module, or on a line of its own", () => {
    const text = 'import { a } from "./a.js";\nimport type { T } from "./t.js";\n\nconst x = 1;\n';

    expect(addImport(text, "./a.js", "b")).toContain('import { a, b } from "./a.js";');
    expect(addImport(text, "./t.js", "U", true)).toContain('import type { T, U } from "./t.js";');
    expect(addImport(text, "./a.js", "a")).toBe(text);
    expect(addImport(text, "./c.js", "c")).toBe(
      'import { a } from "./a.js";\nimport type { T } from "./t.js";\nimport { c } from "./c.js";\n\nconst x = 1;\n',
    );
    expect(addImportLine("const x = 1;\n", 'import { c } from "./c.js";')).toBe(
      'import { c } from "./c.js";\nconst x = 1;\n',
    );
  });

  it("adds an entry last to a list, an object or an interface", () => {
    expect(addEntry("const L = [\n  a,\n];\n", "const L", "];", "b,")).toBe(
      "const L = [\n  a,\n  b,\n];\n",
    );
    expect(addEntry("interface I {\n  a: A;\n}\n", "interface I {", "\n}", "b: B;")).toBe(
      "interface I {\n  a: A;\n  b: B;\n}\n",
    );
    expect(() => addEntry("const L = [];", "const M", "];", "b,")).toThrow('can\'t find "const M"');
    expect(() => addEntry("const L = [", "const L", "];", "b,")).toThrow("can't find the end");
  });

  it("adds a panel to the editor test's list, sorted, or says it can't find it", () => {
    const test = '    ).toEqual(["add", "undoHistory"]);';

    expect(
      listEditorPanel(
        `.toSorted(),
${test}`,
        "notes",
      ),
    ).toContain('.toEqual(["add", "notes", "undoHistory"]);');
    expect(() => listEditorPanel("expect(ids).toEqual([]);", "notes")).toThrow(
      "editor's list of panels",
    );
  });

  it("registers an area's strings in en.ts: imported, in areas and in en", () => {
    const index = [
      'import { app } from "./en/app.js";',
      "",
      "export const areas = {",
      "  app,",
      "} as const;",
      "",
      "export const en = {",
      "  ...app,",
      "} as const;",
      "",
    ].join("\n");

    const text = registerStrings(index, "opening-times");

    expect(text).toContain('import { openingTimes } from "./en/openingTimes.js";');
    expect(text).toContain("  app,\n  openingTimes,\n} as const;");
    expect(text).toContain("  ...app,\n  ...openingTimes,\n} as const;");
  });
});

describe("scaffold on the repository's files", () => {
  // Each edit finds its place in the files as they are now, without writing anything: a file
  // changed so a scaffold can't find its place fails here.
  const plans = {
    area: () => planFor("area", "Bookings", { root: REPO }),
    "window area": () => planFor("area", "Bookings", { root: REPO, scope: "window" }),
    panel: () => planFor("panel", "Bookings", { root: REPO, folder: "site" }),
    commands: () => planFor("commands", "ShowBookings", { root: REPO, folder: "bookings" }),
    "window commands": () =>
      planFor("commands", "JumpHome", { root: REPO, folder: "site", scope: "window" }),
    "field kind": () => planFor("field-kind", "Rating", { root: REPO }),
    "IPC domain": () => planFor("ipc-domain", "Calendar", { root: REPO }),
  };

  for (const [what, plan] of Object.entries(plans)) {
    it(`finds the places a ${what} goes`, () => {
      expect(Object.keys(applyEdits(plan(), REPO)).length).toBeGreaterThan(0);
    });
  }

  it("knows the strings' keys", () => {
    expect(stringKeys(REPO)).toContain("editor.undoHistory");
  });
});

describe("scaffold", () => {
  it("writes an area, its panel and commands, each listed, with their strings", () => {
    const root = copyOfRepo(PANEL);

    const area = scaffold(planFor("area", "Bookings", { root }), root, false);
    const panel = scaffold(planFor("panel", "Bookings", { root, folder: "bookings" }), root, false);
    const commands = scaffold(
      planFor("commands", "ShowBookings", { root, folder: "bookings" }),
      root,
      false,
    );

    expect(area.written).toEqual([
      "apps/desktop/src/renderer/bookings/area.ts",
      "apps/desktop/src/renderer/bookings/area.test.ts",
      "packages/i18n/src/en/bookings.ts",
    ]);
    expect(area.changed).toEqual(["apps/desktop/src/renderer/areas.ts", "packages/i18n/src/en.ts"]);
    expect(panel.written).toContain(
      "apps/desktop/src/renderer/bookings/register-bookings-panel.stories.tsx",
    );
    expect(commands.written).toContain(
      "apps/desktop/src/renderer/bookings/show-bookings-commands.ts",
    );
    const areaFile = read(root, "apps/desktop/src/renderer/bookings/area.ts");
    expect(areaFile).toContain(
      'import { registerBookingsPanel } from "./register-bookings-panel.js";',
    );
    expect(areaFile).toContain("export const showBookingsCommandsArea: Area<EditorContext> = {");
    const list = read(root, "apps/desktop/src/renderer/areas.ts");
    expect(list).toContain(
      'import { bookingsArea, bookingsPanelArea, showBookingsCommandsArea } from "./bookings/area.js";',
    );
    expect(list).toMatch(
      /headerToolbarArea,\n[\s\S]*bookingsArea,\n {2}bookingsPanelArea,\n {2}showBookingsCommandsArea,\n\];/,
    );
    const strings = read(root, "packages/i18n/src/en/bookings.ts");
    expect(strings).toContain('"bookings.panelTitle": "Bookings",');
    expect(strings).toContain('"command.showBookings": "Show bookings",');
    expect(read(root, "apps/desktop/src/renderer/bookings/show-bookings-commands.ts")).toContain(
      'id: "bookings.showBookings",',
    );
    expect(area.formatted).toBe(false);
  });

  it("adds the window's commands to an area there is, with its strings", () => {
    const root = copyOfRepo([...AREA, ...SITE]);

    const result = scaffold(
      planFor("commands", "JumpHome", { root, folder: "site", scope: "window" }),
      root,
      false,
    );

    expect(result.changed).toEqual(
      expect.arrayContaining([
        "apps/desktop/src/renderer/site/area.ts",
        "apps/desktop/src/renderer/areas.ts",
        "packages/i18n/src/en/panels.ts",
      ]),
    );
    expect(read(root, "apps/desktop/src/renderer/site/area.ts")).toContain(
      "export const jumpHomeCommandsArea: Area<WindowContext> = {",
    );
    expect(read(root, "apps/desktop/src/renderer/areas.ts")).toMatch(
      /WINDOW_AREAS[\s\S]*jumpHomeCommandsArea,\n\];/,
    );
    // The Site panel's strings are in panels.ts, so its commands' are too.
    expect(read(root, "packages/i18n/src/en/panels.ts")).toContain(
      '"command.jumpHome": "Jump home",',
    );
  });

  it("puts an area's strings where the area keeps them, never in a file beside them", () => {
    const root = copyOfRepo([...PANEL, ...LAYERS]);

    const result = scaffold(planFor("panel", "Outline", { root, folder: "layers" }), root, false);

    expect(result.changed).toContain("packages/i18n/src/en/panels.ts");
    expect(result.written).not.toContain("packages/i18n/src/en/layers.ts");
    expect(existsSync(join(root, "packages/i18n/src/en/layers.ts"))).toBe(false);
    expect(read(root, "packages/i18n/src/en/panels.ts")).toContain(
      '"outline.panelTitle": "Outline",',
    );
  });

  it("writes a kind of field in all seven places", () => {
    const root = copyOfRepo(FIELD_KIND);

    const result = scaffold(planFor("field-kind", "Rating", { root }), root, false);

    expect(result.written).toContain(
      "apps/desktop/src/renderer/fields/rating/RatingField.stories.tsx",
    );
    expect(result.changed).toHaveLength(8);
    expect(read(root, "packages/site-components/src/schema.ts")).toContain(
      '| { readonly kind: "rating"; readonly label: string }',
    );
    expect(read(root, "apps/desktop/src/renderer/fields/field-kinds.ts")).toContain(
      'rating: { editPanel: "rating", story: "Edit/Fields/Rating" },',
    );
    expect(read(root, "apps/desktop/src/renderer/fields/field-renderers.ts")).toContain(
      "    rating: ratingField(),",
    );
    expect(read(root, "packages/editor-ui/src/components/edit/field-spec.ts")).toContain(
      "  readonly rating: Nothing;\n};",
    );
  });

  it("writes an IPC domain from the contract to main's handler", () => {
    const root = copyOfRepo(IPC_DOMAIN);

    const result = scaffold(planFor("ipc-domain", "Calendar", { root }), root, false);

    expect(result.written).toEqual([
      "apps/desktop/src/shared/ipc/calendar.ts",
      "apps/desktop/src/preload/api/calendar.ts",
      "apps/desktop/src/main/calendar-ipc.ts",
      "apps/desktop/src/main/calendar-ipc.test.ts",
    ]);
    expect(read(root, "apps/desktop/src/shared/ipc-contract.ts")).toContain(
      "calendar: calendarChannels,",
    );
    expect(read(root, "apps/desktop/src/shared/webforge-api.ts")).toContain(
      "  readonly calendar: CalendarApi;\n}",
    );
    expect(read(root, "apps/desktop/src/preload/api.ts")).toContain(
      "    calendar: calendarApi(call),",
    );
    expect(read(root, "apps/desktop/src/main/app.ts")).toContain(
      "    registerCalendarHandlers(ipcMain, isTrustedSender);",
    );
  });

  it("formats what it wrote and changed, and says whether that worked", () => {
    const root = copyOfRepo(AREA);
    const format = vi.fn(() => true);

    const result = scaffold(planFor("area", "Bookings", { root }), root, format);

    expect(result.formatted).toBe(true);
    expect(format).toHaveBeenCalledWith(
      expect.arrayContaining(["apps/desktop/src/renderer/areas.ts"]),
      root,
    );
  });

  it("refuses what is there already, writing nothing", () => {
    const root = copyOfRepo(AREA);
    const plan = planFor("area", "Bookings", { root });
    scaffold(plan, root, false);

    expect(() => scaffold(plan, root, false)).toThrow(/exists already/);
  });

  it("writes nothing when a file can't take what it adds", () => {
    const root = copyOfRepo(AREA);
    const list = join(root, "apps/desktop/src/renderer/areas.ts");
    writeFileSync(list, "export const SOMETHING_ELSE = [];\n");

    expect(() => scaffold(planFor("area", "Bookings", { root }), root, false)).toThrow(
      /areas\.ts: can't find "export const EDITOR_AREAS"/,
    );
    expect(existsSync(join(root, "apps/desktop/src/renderer/bookings"))).toBe(false);
    expect(existsSync(dirname(list))).toBe(true);
  });
});

describe("scaffold's refusals", () => {
  it("refuses a name it can't use, or that something has already", () => {
    expect(() => planFor("area", "bookings", { root: REPO })).toThrow(/isn't a name/);
    expect(() => planFor("area", "Site", { root: REPO })).toThrow(/renderer\/site exists already/);
    expect(() => planFor("field-kind", "Icon", { root: REPO })).toThrow(
      /has a "icon" kind already/,
    );
    expect(() => planFor("ipc-domain", "SpellCheck", { root: REPO })).toThrow(/one word/);
    expect(() => planFor("ipc-domain", "Clipboard", { root: REPO })).toThrow(/exists already/);
  });

  it("refuses an area whose strings file it doesn't know, rather than starting another", () => {
    expect(() => planFor("panel", "Timings", { root: REPO, folder: "perf" })).toThrow(
      /renderer\/perf keeps its strings in a file the scaffold doesn't know: add it to STRINGS_FILES/,
    );
  });

  it("knows where every area that has strings keeps them", () => {
    const renderer = join(REPO, "apps/desktop/src/renderer");
    // Every area (not what every area builds on, nor a folder such as node_modules), but those with
    // no strings of their own.
    const areas = readdirSync(renderer, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => folderProblem(name) === undefined && !["fields", "perf"].includes(name));
    const fileOf = (area: string) =>
      `packages/i18n/src/en/${STRINGS_FILES[area] ?? area.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())}.ts`;

    const unknown = areas.filter((area) => !existsSync(join(REPO, fileOf(area))));

    expect(unknown).toEqual([]);
    expect(areas).toContain("layers");
  });

  it("puts a panel or commands in an area's folder only", () => {
    expect(() => planFor("commands", "Show", { root: REPO, folder: "shell" })).toThrow(
      /what every area builds on/,
    );
    expect(() => planFor("panel", "Editor", { root: REPO })).toThrow(/what every area builds on/);
  });

  it("puts a panel in the name's own folder when no area is given (#322's pnpm scaffold panel Notes)", () => {
    const root = copyOfRepo(PANEL);

    const result = scaffold(planFor("panel", "Notes", { root }), root, false);

    expect(result.written).toEqual(
      expect.arrayContaining([
        "apps/desktop/src/renderer/notes/NotesPanel.tsx",
        "apps/desktop/src/renderer/notes/register-notes-panel.stories.tsx",
        "apps/desktop/src/renderer/notes/area.ts",
        "packages/i18n/src/en/notes.ts",
      ]),
    );
    expect(read(root, "apps/desktop/src/renderer/areas.ts")).toContain("notesPanelArea,");
    // The editor's test expects it among its panels.
    expect(read(root, "apps/desktop/src/renderer/editor/Editor.test.tsx")).toContain(
      '.toEqual(["add", "edit", "media", "notes", "undoHistory"]);',
    );
  });

  it("refuses strings the app has already", () => {
    const root = copyOfRepo(PANEL);
    scaffold(planFor("panel", "Bookings", { root, folder: "bookings" }), root, false);

    expect(() => planFor("panel", "Bookings", { root, folder: "other" })).toThrow(
      /The strings have bookings\.panelTitle, bookings\.panelEmpty already/,
    );
  });
});

describe("pnpm scaffold", () => {
  it("says how to use it when asked for something it doesn't make", () => {
    const errors = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    main(["widget", "Bookings"]);
    main(["panel"]);
    main(["panel", "--area", "bookings"]);

    expect(errors).toHaveBeenCalledTimes(3);
    expect(String(errors.mock.calls[0]?.[0])).toContain("pnpm scaffold area <Name> [--window]");
    expect(process.exitCode).toBe(1);
  });

  it("lists what it wrote and changed, and what to do next", () => {
    const root = copyOfRepo(PANEL);
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    main(["panel", "Bookings", "--area", "bookings", "--window"], { root, format: () => true });

    const printed = output.mock.calls.map(([text]) => String(text)).join("");
    expect(printed).toContain("wrote apps/desktop/src/renderer/bookings/BookingsPanel.tsx");
    expect(printed).toContain("changed apps/desktop/src/renderer/areas.ts");
    expect(printed).toContain("Then pnpm check.");
    expect(read(root, "apps/desktop/src/renderer/bookings/area.ts")).toContain(
      "Area<WindowContext>",
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("says when it can't, or couldn't format what it wrote", () => {
    const root = copyOfRepo([...AREA, ...SITE]);
    const errors = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    main(["area", "Site"], { root, format: false });
    main(["area", "Bookings"], { root, format: false });

    const printed = errors.mock.calls.map(([text]) => String(text)).join("");
    expect(printed).toContain("renderer/site exists already");
    expect(printed).toContain("formatting failed: run pnpm format");
    expect(process.exitCode).toBe(1);
  });
});
