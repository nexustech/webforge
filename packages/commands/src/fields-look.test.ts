import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { home, setup } from "./api.test-helper.js";

describe("the fields query, with the theme's looks (#670)", () => {
  it("reports what an element draws with: its own value, its kind's look, or the default", () => {
    const { host, history } = setup(true, (doc) => {
      doc.theme.looks = { Heading: { lookItalic: true, lookUnderline: true } };
      const heading = doc.pages[doc.homePageId]?.doc.content[0]?.props.content;
      if (!Array.isArray(heading)) throw new Error("no heading");
      heading[0].props.lookUnderline = false;
    });

    const answer = createCommandApi(host).query("fields", {
      location: home(history),
      nodeId: "heading",
    }) as { status: string; data: { fields: Record<string, { value: unknown; source?: string }> } };

    expect(answer.status).toBe("done");
    const { fields } = answer.data;
    expect(fields.text).toMatchObject({ value: "Welcome", source: "own" });
    // The look's italics, which every Heading takes; this one sets its own underline.
    expect(fields.lookItalic).toMatchObject({ value: true, source: "look" });
    expect(fields.lookUnderline).toMatchObject({ value: false, source: "own" });
  });
});
