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
});
