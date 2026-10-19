import { siteSnapshotSchema } from "@webforge/model";
import { starterPage } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { singlePageSnapshot } from "./site-snapshot.js";

describe("singlePageSnapshot", () => {
  it("makes the editor's page the home page of a valid site with Header and Footer", () => {
    const page = starterPage();

    const snapshot = singlePageSnapshot("My site", page);

    expect(siteSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.pages).toEqual([{ path: "index", title: "My site", doc: page }]);
    expect(snapshot.layout.header[0]?.props.siteName).toBe("My site");
    expect(snapshot.media).toEqual([]);
  });
});
