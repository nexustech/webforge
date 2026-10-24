import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  moduleFile,
  type Names,
  namesOf,
  newComponent,
  registerInCatalogue,
  registerInStrings,
  storyFile,
  stringsFile,
  testFile,
} from "./new-component.js";

// `pnpm new-component` (2.19). That what it writes passes `pnpm check` and renders in Storybook
// was checked by running it on the repository; these check what it writes and where.

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
    expect(stringsFile(names, "section")).toContain('"section.priceList": "Price list",');
    expect(stringsFile(names, "section")).toContain('"starter.priceListTitle": "Price list",');
  });

  it("writes an element with its margin, and a child with neither margin nor category", () => {
    const element = moduleFile(names, "element");
    const child = moduleFile(names, "child");

    expect(element).toContain("const priceList = defineComponent({");
    expect(element).toContain("margin: MARGIN_FIELD,");
    expect(element).toContain('category: t("category.priceList"),');
    expect(child).toContain('place: "child",');
    expect(child).not.toContain("category");
    expect(child).not.toContain("margin");
    expect(stringsFile(names, "child")).not.toContain("category.");
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
});

describe("newComponent", () => {
  let root = "";
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A repository with just the two index files `newComponent` registers families in. */
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
    return root;
  }

  it("writes the family's four files and registers it, then refuses to write it again", () => {
    const at = repository();

    const written = newComponent("PriceList", "section", at, false);

    expect(written).toEqual([
      "packages/site-components/src/catalogue/price-list.tsx",
      "packages/site-components/src/catalogue/price-list.stories.tsx",
      "packages/site-components/src/catalogue/price-list.test.tsx",
      "packages/i18n/src/en/components/priceList.ts",
      "packages/site-components/src/catalogue/index.ts",
      "packages/i18n/src/en/components/index.ts",
    ]);
    const read = (path: string) => readFileSync(join(at, path), "utf8");
    expect(read(written[0] ?? "")).toContain("defineSection");
    expect(read("packages/site-components/src/catalogue/index.ts")).toContain(
      "priceListComponents,",
    );
    expect(read("packages/i18n/src/en/components/index.ts")).toContain("...priceList,");
    expect(() => newComponent("PriceList", "section", at, false)).toThrow("exists already");
  });

  it("refuses a name that isn't a component type", () => {
    expect(() => newComponent("price", "element", repository(), false)).toThrow(
      "isn't a component type",
    );
  });
});
