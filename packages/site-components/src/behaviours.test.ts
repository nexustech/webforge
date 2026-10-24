import { describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "./behaviours.js";

// Each file of behaviours/ as Vite reads it: only here, in a test, so the package itself loads
// without Vite.
const FILES = import.meta.glob("./behaviours/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the behaviours (R7)", () => {
  it("are each file of behaviours/ as it is: after changing one, run `pnpm behaviours`", () => {
    const files = Object.fromEntries(
      Object.entries(FILES).map(([path, text]) => [path.replace(/^.*\/|\.js$/g, ""), text]),
    );

    expect(BEHAVIOUR_SCRIPTS).toEqual(files);
    expect(Object.keys(BEHAVIOUR_SCRIPTS)).toContain("menu");
  });
});
