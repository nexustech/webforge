import type { PublishDestination } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { fillWebAddress, webAddressFrom } from "./web-address.js";

/** A file-transfer destination visited at `url`. */
const at = (url?: string): PublishDestination => ({
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "Live",
  kind: "file-transfer",
  settings: {
    protocol: "ftps",
    host: "ftp.example.com",
    user: "rosa",
    folder: "/",
    ...(url === undefined ? {} : { url }),
  },
});

describe("webAddressFrom (4.4a)", () => {
  it("gives a whole site's address as Site Settings keeps it", () => {
    expect(webAddressFrom(at("https://www.rosasbakery.co.uk/"))).toBe(
      "https://www.rosasbakery.co.uk",
    );
    expect(webAddressFrom(at("https://www.rosasbakery.co.uk"))).toBe(
      "https://www.rosasbakery.co.uk",
    );
  });

  it("gives none for a site in a folder of its host, or no address", () => {
    expect(webAddressFrom(at("https://example.com/shop/"))).toBeUndefined();
    expect(webAddressFrom(at())).toBeUndefined();
  });
});

describe("fillWebAddress", () => {
  it("fills Site Settings' web address when the site has none, as one undo step", () => {
    const session = sessionWith();
    const steps = session.history.state.getState().entries.length;

    expect(fillWebAddress(session, at("https://www.rosasbakery.co.uk/"))).toBe(true);
    expect(session.history.document.getState().settings.address.url).toBe(
      "https://www.rosasbakery.co.uk",
    );
    const entries = session.history.state.getState().entries;
    expect(entries).toHaveLength(steps + 1);
    expect(entries.at(-1)?.label).toBe("Changed Site Settings: Web address");
  });

  it("leaves a web address the site already has", () => {
    const session = sessionWith();
    fillWebAddress(session, at("https://first.example/"));

    expect(fillWebAddress(session, at("https://second.example/"))).toBe(false);
    expect(session.history.document.getState().settings.address.url).toBe("https://first.example");
  });
});
