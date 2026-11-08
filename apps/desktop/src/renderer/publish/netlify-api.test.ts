import { describe, expect, it, vi } from "vitest";
import type { NetlifyApi } from "../../shared/ipc/netlify.js";
import { netlifyThrough } from "./netlify-api.js";

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const HANDLE = "8d2c1f0e-1111-4222-8333-444455556666";
const SITE = { id: "3d3f0a5e-1111-4222-8333-444455556666", name: "rosas-bakery" };

/** The preload's Netlify calls, each a spy. */
function fakeNetlify() {
  return {
    status: vi.fn<NetlifyApi["status"]>(async () => ({ canSignIn: true })),
    signIn: vi.fn<NetlifyApi["signIn"]>(async () => ({ status: "signed-in", handle: HANDLE })),
    cancelSignIn: vi.fn<NetlifyApi["cancelSignIn"]>(async () => null),
    forgetSignIn: vi.fn<NetlifyApi["forgetSignIn"]>(async () => null),
    signInWithToken: vi.fn<NetlifyApi["signInWithToken"]>(async () => ({
      status: "signed-in",
      handle: HANDLE,
    })),
    sites: vi.fn<NetlifyApi["sites"]>(async () => ({ status: "listed", sites: [SITE] })),
    createSite: vi.fn<NetlifyApi["createSite"]>(async () => ({ status: "created", site: SITE })),
    testSaved: vi.fn<NetlifyApi["testSaved"]>(async () => ({ ok: true })),
    saveDestination: vi.fn<NetlifyApi["saveDestination"]>(async () => ({
      status: "failed",
      reason: "unknown",
    })),
  } satisfies NetlifyApi;
}

describe("the Publish dialog's Netlify calls (4.4b)", () => {
  it("gives each browser sign-in its own operation id, which Cancel Sign-In names", async () => {
    const netlify = fakeNetlify();
    let next = 0;
    const api = netlifyThrough(
      netlify,
      () => SESSION,
      () => `op-${++next}`,
    );
    let finish: (value: Awaited<ReturnType<NetlifyApi["signIn"]>>) => void = () => undefined;
    netlify.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    const signingIn = api.signIn();
    api.cancelSignIn();
    finish({ status: "failed", reason: "cancelled" });

    expect(await signingIn).toEqual({ status: "failed", reason: "cancelled" });
    expect(netlify.signIn).toHaveBeenCalledWith("op-1");
    expect(netlify.cancelSignIn).toHaveBeenCalledWith("op-1");
    // Over, so a Cancel names nothing; the next sign-in has an id of its own.
    api.cancelSignIn();
    expect(netlify.cancelSignIn).toHaveBeenCalledTimes(1);
    await api.signIn();
    expect(netlify.signIn).toHaveBeenLastCalledWith("op-2");
  });

  it("asks for the open site's session, and lets a sign-in go without waiting", async () => {
    const netlify = fakeNetlify();
    const api = netlifyThrough(netlify, () => SESSION);

    await api.sites({ handle: HANDLE });
    await api.createSite({ saved: SITE.id }, undefined);
    await api.testSaved(SITE.id);
    await api.save({ name: "Shop", site: SITE }, { handle: HANDLE });
    api.forgetSignIn?.(HANDLE);

    expect(netlify.sites).toHaveBeenCalledWith(SESSION, { handle: HANDLE });
    expect(netlify.createSite).toHaveBeenCalledWith(SESSION, { saved: SITE.id }, undefined);
    expect(netlify.testSaved).toHaveBeenCalledWith(SESSION, SITE.id);
    expect(netlify.saveDestination).toHaveBeenCalledWith(
      SESSION,
      { name: "Shop", site: SITE },
      { handle: HANDLE },
    );
    expect(netlify.forgetSignIn).toHaveBeenCalledWith(HANDLE);
  });
});
