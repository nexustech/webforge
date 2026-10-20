import { describe, expect, it, vi } from "vitest";
import { createWebforgeApi } from "./api.js";

describe("createWebforgeApi", () => {
  it("calls the contract channel and returns the parsed app info", async () => {
    const invoke = vi.fn(async () => ({ name: "Webforge", version: "1.0.0" }));
    const api = createWebforgeApi(invoke);

    await expect(api.app.getInfo()).resolves.toEqual({ name: "Webforge", version: "1.0.0" });
    expect(invoke).toHaveBeenCalledWith("app:get-info");
  });

  it("rejects a response that does not match the contract", async () => {
    const api = createWebforgeApi(async () => ({ name: 42 }));

    await expect(api.app.getInfo()).rejects.toThrow();
  });

  it("calls the site channels and returns their parsed results", async () => {
    const project = { name: "Bakery", fileName: "Bakery.wforge", formatVersion: 1 };
    const responses: Record<string, unknown> = {
      "project:create": { status: "opened", project },
      "project:open": { status: "canceled" },
      "project:get-current": null,
    };
    const api = createWebforgeApi(async (channel) => responses[channel]);

    await expect(api.project.create()).resolves.toEqual({ status: "opened", project });
    await expect(api.project.open()).resolves.toEqual({ status: "canceled" });
    await expect(api.project.getCurrent()).resolves.toBeNull();
  });

  it("rejects a site result that does not match the contract", async () => {
    const api = createWebforgeApi(async () => ({ status: "opened", project: { path: "C:\\" } }));

    await expect(api.project.open()).rejects.toThrow();
  });
});

describe("createWebforgeApi site export", () => {
  const snapshot = {
    name: "Bakery",
    language: "en",
    theme: { name: "light" },
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
    ],
    media: [],
  };

  it("sends the snapshot on the export channel and parses the result", async () => {
    const result = { status: "exported", folderName: "site", pages: 1, files: 5, warnings: 0 };
    const invoke = vi.fn(async () => result);
    const api = createWebforgeApi(invoke);

    await expect(api.site.export(snapshot)).resolves.toEqual(result);
    expect(invoke).toHaveBeenCalledWith("site:export", snapshot);
  });

  it("rejects an export result that leaks a path", async () => {
    const api = createWebforgeApi(async () => ({
      status: "exported",
      folderName: "site",
      path: "C:Userssamsite",
      pages: 1,
      files: 5,
      warnings: 0,
    }));

    await expect(api.site.export(snapshot)).rejects.toThrow();
  });
});
