import { configDefaults, defineProject } from "vitest/config";

export default defineProject({
  test: {
    // The UI-string guard's fixtures include a *.test.tsx that the guard must skip; it is data.
    exclude: [...configDefaults.exclude, "test/fixtures/**"],
  },
});
