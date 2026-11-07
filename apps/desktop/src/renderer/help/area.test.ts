import { createSite } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { helpForElementArea } from "./area.js";

/** A page with a Heading, and a Gallery holding one image. */
function setUp() {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    homeDoc: {
      root: { props: {} },
      content: [
        { type: "Heading", props: { id: "title", text: "Fresh bread" } },
        {
          type: "Gallery",
          props: { id: "gallery", images: [{ type: "GalleryImage", props: { id: "loaf" } }] },
        },
      ],
    },
  });
  const session = sessionWith(site);
  const registries = registriesForTest();
  const open = vi.fn(async () => true);
  const api = fakePreloadApi({ help: { open } });
  const remove = helpForElementArea.register({
    ...registries,
    api,
    session,
  } as unknown as WindowContext);
  return { session, commands: registries.commands, open, remove };
}

describe("Help for this element (5.4b, UX-24)", () => {
  it("is off until one element is selected, then opens its page at its heading", async () => {
    const { session, commands, open } = setUp();
    const command = () => commands.get(COMMAND_IDS.helpForElement);
    expect(command()).toMatchObject({ label: "Help for This Element", enabled: false });

    session.select("title");
    expect(command()?.enabled).toBe(true);
    await commands.run(COMMAND_IDS.helpForElement);
    expect(open).toHaveBeenLastCalledWith({ page: "elements", anchor: "heading" });

    // A Gallery's image opens at its Gallery.
    session.select("loaf");
    await commands.run(COMMAND_IDS.helpForElement);
    expect(open).toHaveBeenLastCalledWith({ page: "sections", anchor: "gallery" });

    session.select(null);
    expect(command()?.enabled).toBe(false);
    await commands.run(COMMAND_IDS.helpForElement);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("removes its command when unregistered", () => {
    const { commands, remove } = setUp();
    remove();
    expect(commands.get(COMMAND_IDS.helpForElement)).toBeUndefined();
  });
});
