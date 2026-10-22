import { FILE_MIME_TYPES } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { documentIcon, documentTypeName, fileSizeLabel } from "./document-types.js";

describe("document types (1.28)", () => {
  it("names every type Media takes, with an icon", () => {
    for (const type of FILE_MIME_TYPES) {
      expect(documentTypeName(type)).not.toBe("");
      expect(documentIcon(type)).toBeDefined();
    }
    expect(documentTypeName("text/csv")).toBe("CSV file");
  });

  it("gives sizes in KB under a megabyte and MB above it", () => {
    expect(fileSizeLabel(0)).toBe("1 KB");
    expect(fileSizeLabel(839_680)).toBe("820 KB");
    expect(fileSizeLabel(1_468_006)).toBe("1.4 MB");
    expect(fileSizeLabel(52_428_800)).toBe("50 MB");
  });
});
