import { describe, expect, it } from "vitest";
import { appChannels } from "./ipc/app.js";
import { projectChannels } from "./ipc/project.js";
import { siteChannels } from "./ipc/site.js";
import { ipcContract } from "./ipc-contract.js";

const domains = { app: appChannels, project: projectChannels, site: siteChannels };

describe("ipcContract", () => {
  it("contains every domain's entries, none overwritten by another domain", () => {
    const entries = Object.values(domains).flatMap((channels) => Object.keys(channels));

    expect(new Set(entries).size).toBe(entries.length);
    expect(Object.keys(ipcContract).sort()).toEqual([...entries].sort());
  });

  it("uses unique channels, each prefixed with its domain", () => {
    for (const [domain, channels] of Object.entries(domains)) {
      for (const { channel } of Object.values(channels)) {
        expect(channel.startsWith(`${domain}:`), channel).toBe(true);
      }
    }
    const channels = Object.values(ipcContract).map((entry) => entry.channel);
    expect(new Set(channels).size).toBe(channels.length);
  });
});
