import { describe, expect, it } from "vitest";
import { mediaIdSchema, menuItemIdSchema, newId, nodeIdSchema, pageIdSchema } from "./ids.js";

describe("newId", () => {
  it("makes 16-character ids that every id schema accepts", () => {
    for (const kind of ["page", "node", "media", "menuItem"] as const) {
      const id = newId(kind);

      expect(id).toMatch(/^[0-9A-Za-z]{16}$/);
      expect(pageIdSchema.parse(id)).toBe(id);
    }
  });

  it("does not repeat itself", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId("page")));

    expect(ids.size).toBe(1000);
  });
});

describe("id schemas", () => {
  it.each(["home", "Heading-1b2c3d4e-0000-4000-8000-000000000000", "a_b", "9"])(
    "accept %j",
    (id) => {
      for (const schema of [pageIdSchema, nodeIdSchema, mediaIdSchema, menuItemIdSchema]) {
        expect(schema.parse(id)).toBe(id);
      }
    },
  );

  it.each(["", "__proto__", "-a", "a b", "a/b", "a.b", "x".repeat(65), 1])("reject %j", (id) => {
    expect(pageIdSchema.safeParse(id).success).toBe(false);
  });
});
