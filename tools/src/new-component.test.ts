import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHelp, HELP_PATHS } from "./check-help.js";
import {
  categoriesIn,
  main,
  moduleFile,
  type Names,
  namesOf,
  newComponent,
  registerInCatalogue,
  registerInHelpPage,
  registerInStrings,
  storyFile,
  stringsFile,
  testFile,
} from "./new-component.js";

// `pnpm new-component` (2.19). These check what it writes and where; the last checks that the help
// pages pass `pnpm help-check` with new components on them (#979).

const names = namesOf("PriceList") as Names;

describe("new-component's names", () => {
  it("names a family after its component type", () => {
    expect(namesOf("PriceList")).toEqual({
      type: "PriceList",
      file: "price-list",
      camel: "priceList",
      label: "Price list",
    });
    expect(namesOf("Badge")).toMatchObject({ file: "badge", camel: "badge", label: "Badge" });
  });

  it("refuses a type that isn't PascalCase", () => {
    for (const bad of ["priceList", "Price-List", "Price List", ""]) {
      expect(namesOf(bad), bad).toMatch(/isn't a component type/);
    }
  });
});

describe("new-component's files", () => {
  it("writes a section with defineSection and the primitives, its strings by key", () => {
    const module = moduleFile(names, "section");

    expect(module).toContain("const priceList = defineSection({");
    expect(module).toContain('name: "price-list",');
    expect(module).toContain('label: t("section.priceList"),');
    expect(module).toContain("<SectionTitle>{values.title}</SectionTitle>");
    expect(module).toContain("PriceList: priceList,");
    expect(module).not.toContain("padding");
    // Its content width (3.21), Narrow as a section of text is.
    expect(module).toContain('contentWidth: "narrow",');
    expect(module).toContain("contentWidthClass(values.contentWidth)");
    expect(stringsFile(names, "section")).toContain('"section.priceList": "Price list",');
    expect(stringsFile(names, "section")).toContain('"starter.priceListTitle": "Price list",');
  });

  it("writes an element with its margin in a group the Add panel has, and a child with neither", () => {
    const element = moduleFile(names, "element", "text");
    const child = moduleFile(names, "child");

    expect(element).toContain("const priceList = defineComponent({");
    expect(element).toContain("margin: MARGIN_FIELD,");
    expect(element).toContain('category: t("category.text"),');
    expect(moduleFile(names, "section", "pricing")).toContain('category: t("category.pricing"),');
    expect(child).toContain('place: "child",');
    expect(child).not.toContain("category");
    expect(child).not.toContain("margin");
    // The group is one there is already (#979), so no family brings its own.
    for (const place of ["section", "element", "child"] as const) {
      expect(stringsFile(names, place)).not.toContain("category.");
    }
    expect(stringsFile(names, "element")).toContain('"element.priceList": "Price list",');
  });

  it("writes a story and a test that render it with its defaults, as the Add panel places it", () => {
    expect(storyFile(names)).toContain("...siteLibrary.components.PriceList?.defaults");
    expect(storyFile(names)).toContain('title: "Site components/Price list",');
    expect(testFile(names)).toContain("...defaults } }],");
    expect(testFile(names)).toContain('t("starter.priceListText")');
  });
});

describe("new-component's registration", () => {
  it("adds the family to the catalogue: imported, and last in createLibrary", () => {
    const index = [
      'import { basicComponents } from "./basic.js";',
      'import { layoutComponents } from "./layout.js";',
      "",
      "export const siteLibrary = createLibrary(",
      "  layoutComponents,",
      "  basicComponents,",
      ");",
      "",
    ].join("\n");

    const registered = registerInCatalogue(index, names);

    expect(registered).toContain('import { priceListComponents } from "./price-list.js";');
    expect(registered).toContain("  basicComponents,\n  priceListComponents,\n);");
  });

  it("refuses a catalogue index without createLibrary", () => {
    expect(() => registerInCatalogue('import { a } from "./a.js";\n', names)).toThrow(
      "createLibrary",
    );
  });

  it("adds the family's strings, the families' list on one line or wrapped", () => {
    const oneLine = [
      'import { basic } from "./basic.js";',
      "",
      "export const componentFamilies = { shared, basic } as const;",
      "",
      "export const components = {",
      "  ...shared,",
      "  ...basic,",
      "} as const;",
      "",
    ].join("\n");
    const wrapped = oneLine.replace("{ shared, basic }", "{\n  shared,\n  basic,\n}");

    for (const index of [oneLine, wrapped]) {
      const registered = registerInStrings(index, names);
      expect(registered).toContain('import { priceList } from "./priceList.js";');
      expect(registered).toContain(
        "export const componentFamilies = { shared, basic, priceList } as const;",
      );
      expect(registered).toContain("  ...basic,\n  ...priceList,\n} as const;");
    }
  });

  it("puts the component on its help page: listed, with a heading to word, and dated (HP-4)", () => {
    const page = [
      "---",
      "",
      "id: sections",
      "title: Sections",
      "components: [Hero, Faq]",
      "updated: 2026-11-01",
      "---",
      "",
      "# Sections",
      "",
      "## FAQ",
      "",
      "Questions.",
      "",
    ].join("\n");

    const registered = registerInHelpPage(page, names, "2026-11-14");

    expect(registered).toContain("components: [Hero, Faq, PriceList]\nupdated: 2026-11-14\n---");
    expect(registered).toMatch(
      /Questions\.\n\n## Price list\n\nSay what the price list is for, .*\n$/,
    );
    const unlisted = registerInHelpPage(page.replace("components: [Hero, Faq]\n", ""), names, "x");
    expect(unlisted).toContain("components: [PriceList]\n---");
    expect(() => registerInHelpPage("# No front matter\n", names, "x")).toThrow("front matter");
  });
});

describe("newComponent", () => {
  let root = "";
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /**
   * A repository with what `newComponent` reads: the two index files it registers families in, a
   * family's strings with Add-panel groups, and a help page.
   */
  function repository(): string {
    root = mkdtempSync(join(tmpdir(), "webforge-new-component-"));
    mkdirSync(join(root, "packages/site-components/src/catalogue"), { recursive: true });
    mkdirSync(join(root, "packages/i18n/src/en/components"), { recursive: true });
    writeFileSync(
      join(root, "packages/site-components/src/catalogue/index.ts"),
      'import { basicComponents } from "./basic.js";\n\nexport const siteLibrary = createLibrary(\n  basicComponents,\n);\n',
    );
    writeFileSync(
      join(root, "packages/i18n/src/en/components/index.ts"),
      'import { basic } from "./basic.js";\n\nexport const componentFamilies = { basic } as const;\n\nexport const components = {\n  ...basic,\n} as const;\n',
    );
    writeFileSync(
      join(root, "packages/i18n/src/en/components/basic.ts"),
      'export const basic = {\n  "category.text": "Text",\n  "category.layout": "Layout",\n} as const;\n',
    );
    mkdirSync(join(root, "docs/help"), { recursive: true });
    writeFileSync(
      join(root, "docs/help/sections.md"),
      "---\nid: sections\ncomponents: [Hero]\nupdated: 2026-11-01\n---\n\n# Sections\n",
    );
    return root;
  }

  /** `PriceList`, a section in Text, on the Sections page; the rest as given. */
  const request = (over: Partial<Parameters<typeof newComponent>[0]> = {}) => ({
    type: "PriceList",
    place: "section" as const,
    helpPage: "sections",
    category: "text",
    ...over,
  });
  /** No formatting or data: what's written, as it's written. */
  const NO_STEPS = { format: false, catalogueData: false, today: "2026-11-14" } as const;

  it("writes the family's four files, registers it and puts it on its help page, once", () => {
    const at = repository();

    const { written } = newComponent(request(), at, NO_STEPS);

    expect(written).toEqual([
      "packages/site-components/src/catalogue/price-list.tsx",
      "packages/site-components/src/catalogue/price-list.stories.tsx",
      "packages/site-components/src/catalogue/price-list.test.tsx",
      "packages/i18n/src/en/components/priceList.ts",
      "packages/site-components/src/catalogue/index.ts",
      "packages/i18n/src/en/components/index.ts",
      "docs/help/sections.md",
    ]);
    const read = (path: string) => readFileSync(join(at, path), "utf8");
    expect(read(written[0] ?? "")).toContain("defineSection");
    expect(read("packages/site-components/src/catalogue/index.ts")).toContain(
      "priceListComponents,",
    );
    expect(read("packages/i18n/src/en/components/index.ts")).toContain("...priceList,");
    expect(read("docs/help/sections.md")).toContain("components: [Hero, PriceList]");
    expect(read("docs/help/sections.md")).toContain("## Price list");
    expect(() => newComponent(request(), at, NO_STEPS)).toThrow("already");
  });

  it("refuses a type another family defines, writing nothing", () => {
    const at = repository();
    writeFileSync(
      join(at, "packages/site-components/src/catalogue/sections.tsx"),
      "export const sectionsComponents: Readonly<Record<string, ComponentDef>> = {\n  Hero: hero,\n  Faq: faq,\n};\n",
    );
    const before = readFileSync(
      join(at, "packages/site-components/src/catalogue/index.ts"),
      "utf8",
    );

    expect(() => newComponent(request({ type: "Hero" }), at, NO_STEPS)).toThrow(
      "The catalogue has a Hero already",
    );
    expect(existsSync(join(at, "packages/site-components/src/catalogue/hero.tsx"))).toBe(false);
    expect(readFileSync(join(at, "packages/site-components/src/catalogue/index.ts"), "utf8")).toBe(
      before,
    );
  });

  it("writes nothing when an index can't take the family", () => {
    const at = repository();
    writeFileSync(
      join(at, "packages/site-components/src/catalogue/index.ts"),
      'import { basicComponents } from "./basic.js";\n',
    );

    expect(() => newComponent(request(), at, NO_STEPS)).toThrow("createLibrary");
    expect(existsSync(join(at, "packages/site-components/src/catalogue/price-list.tsx"))).toBe(
      false,
    );
    expect(existsSync(join(at, "packages/i18n/src/en/components/priceList.ts"))).toBe(false);
    expect(readFileSync(join(at, "docs/help/sections.md"), "utf8")).not.toContain("PriceList");
  });

  it("refuses a group the Add panel hasn't, a child's group and a help page that isn't there", () => {
    const at = repository();

    expect(categoriesIn(at)).toEqual(new Set(["text", "layout"]));
    expect(() => newComponent(request({ category: "prices" }), at, NO_STEPS)).toThrow(
      "--category must be a group the Add panel has: layout, text",
    );
    expect(() => newComponent(request({ category: undefined }), at, NO_STEPS)).toThrow(
      "--category",
    );
    expect(() => newComponent(request({ place: "child" }), at, NO_STEPS)).toThrow(
      "A child has no --category",
    );
    for (const helpPage of ["blog", "../sections", ""]) {
      expect(() => newComponent(request({ helpPage }), at, NO_STEPS), helpPage).toThrow(
        "--help-page must be a page in docs/help",
      );
    }
    expect(existsSync(join(at, "packages/site-components/src/catalogue/price-list.tsx"))).toBe(
      false,
    );
    // A child, with no group, goes on its page all the same.
    newComponent(request({ place: "child", category: undefined }), at, NO_STEPS);
    expect(readFileSync(join(at, "docs/help/sections.md"), "utf8")).toContain("## Price list");
  });

  it("formats what it wrote, then regenerates the catalogue's data, saying whether each worked", () => {
    const failing = newComponent(request(), repository(), {
      ...NO_STEPS,
      format: () => false,
      catalogueData: () => false,
    });
    const steps: string[] = [];
    const done = newComponent(request({ type: "Badge", place: "element" }), repository(), {
      ...NO_STEPS,
      format: (files) => {
        steps.push(`format ${files.length}`);
        return true;
      },
      catalogueData: () => {
        steps.push("catalogue data");
        return true;
      },
    });

    expect(failing).toMatchObject({ formatted: false, catalogueData: false });
    expect(done).toMatchObject({ formatted: true, catalogueData: true });
    // Every code file it wrote, the indexes too (not the help page), then the data from them.
    expect(steps).toEqual([`format ${done.written.length - 1}`, "catalogue data"]);
  });

  it("refuses a name that isn't a component type", () => {
    expect(() => newComponent(request({ type: "price" }), repository(), NO_STEPS)).toThrow(
      "isn't a component type",
    );
  });
});

describe("pnpm new-component", () => {
  let root = "";
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  /** A repository with the indexes, a group and a help page, as `newComponent`'s tests make it. */
  function repository(): string {
    root = mkdtempSync(join(tmpdir(), "webforge-new-component-main-"));
    const write = (path: string, text: string) => {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    write(
      "packages/site-components/src/catalogue/index.ts",
      "export const siteLibrary = createLibrary(\n);\n",
    );
    write(
      "packages/i18n/src/en/components/index.ts",
      "export const componentFamilies = {} as const;\n\nexport const components = {\n} as const;\n",
    );
    write("packages/i18n/src/en/components/basic.ts", '{ "category.text": "Text" }\n');
    write("docs/help/elements.md", "---\nid: elements\nupdated: 2026-11-01\n---\n\n# Elements\n");
    return root;
  }
  const printed = (stream: { mock: { calls: unknown[][] } }) =>
    stream.mock.calls.map(([text]) => String(text)).join("");

  it("says how to use it when the type, its place or its help page is missing", () => {
    const errors = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    main(["--place", "element"]);
    main(["Badge", "--place", "corner", "--help-page", "elements"]);
    main(["Badge", "--place", "element", "--help-page"]);

    expect(errors).toHaveBeenCalledTimes(3);
    expect(printed(errors)).toContain("--help-page <page> [--category <name>]");
    expect(process.exitCode).toBe(1);
  });

  it("lists what it wrote and what to do next", () => {
    const at = repository();
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const args = ["Badge", "--place", "element", "--help-page", "elements", "--category", "text"];

    main(args, { root: at, steps: { format: () => true, catalogueData: () => true } });

    expect(printed(output)).toContain("wrote docs/help/elements.md");
    expect(printed(output)).toContain("word its help page's heading, then pnpm check");
    expect(process.exitCode).toBeUndefined();
  });

  it("says when it can't, or when formatting or the catalogue's data failed", () => {
    const at = repository();
    const errors = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    main(["Badge", "--place", "element", "--help-page", "elements", "--category", "prices"], {
      root: at,
    });
    main(["Badge", "--place", "element", "--help-page", "elements", "--category", "text"], {
      root: at,
      steps: { format: () => false, catalogueData: () => false },
    });

    expect(printed(errors)).toContain("--category must be a group the Add panel has: text");
    expect(printed(errors)).toContain("formatting failed: run pnpm format");
    expect(printed(errors)).toContain("its data failed: run pnpm catalogue-data");
    expect(process.exitCode).toBe(1);
  });
});

describe("new-component's output passes help-check (#979)", () => {
  let root = "";
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("leaves the repository's help pages in order, for a section, an element and a child", () => {
    // A copy of what new-component and help-check read, from this repository.
    const repo = join(import.meta.dirname, "../..");
    root = mkdtempSync(join(tmpdir(), "webforge-new-component-help-"));
    for (const path of [
      "packages/site-components/src/catalogue",
      "packages/i18n/src/en",
      HELP_PATHS.pages,
      HELP_PATHS.catalogue,
      HELP_PATHS.links,
    ]) {
      cpSync(join(repo, path), join(root, path), { recursive: true });
    }
    /** The catalogue's data as `pnpm catalogue-data` writes it, with the new type in it. */
    const catalogueData = (type: string, label: string, place: string) => (at: string) => {
      const file = join(at, HELP_PATHS.catalogue);
      const data = JSON.parse(readFileSync(file, "utf8")) as { components: object };
      data.components = { ...data.components, [type]: { label, place, fields: {} } };
      writeFileSync(file, JSON.stringify(data));
      return true;
    };
    expect(checkHelp(root)).toEqual([]);

    for (const [type, label, place, helpPage, category] of [
      // Names no one will give a real component, so the copy never has them already.
      ["ScaffoldedSection", "Scaffolded section", "section", "sections", "pricing"],
      ["ScaffoldedElement", "Scaffolded element", "element", "elements", "text"],
      ["ScaffoldedItem", "Scaffolded item", "child", "elements", undefined],
    ] as const) {
      newComponent({ type, place, helpPage, category }, root, {
        format: false,
        catalogueData: catalogueData(type, label, place),
        today: "2026-11-14",
      });
    }

    expect(checkHelp(root)).toEqual([]);
  });
});
