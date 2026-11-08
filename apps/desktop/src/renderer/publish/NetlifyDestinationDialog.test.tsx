// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type NetlifyDestinationApi,
  NetlifyDestinationDialog,
  type NetlifyDestinationDialogProps,
  type NetlifySite,
} from "./NetlifyDestinationDialog.js";

afterEach(cleanup);

const HANDLE = "8d2c1f0e-1111-4222-8333-444455556666";
const SAVED = "c0ffee00-1111-4222-8333-444455556666";
const SHOP: NetlifySite = {
  id: "3d3f0a5e-1111-4222-8333-444455556666",
  name: "rosas-bakery",
  url: "https://rosas-bakery.netlify.app",
  protected: false,
};
const STAGING: NetlifySite = {
  id: "7a1b2c3d-1111-4222-8333-444455556666",
  name: "rosas-staging",
  url: "https://rosas-staging.netlify.app",
  protected: true,
};

/** A Netlify the test sets: each call a spy, with two sites. */
function fakeNetlify(overrides: Partial<NetlifyDestinationApi> = {}) {
  return {
    canSignIn: false,
    signIn: vi.fn<NetlifyDestinationApi["signIn"]>(async () => ({
      status: "signed-in",
      handle: HANDLE,
    })),
    cancelSignIn: vi.fn(),
    signInWithToken: vi.fn<NetlifyDestinationApi["signInWithToken"]>(async () => ({
      status: "signed-in",
      handle: HANDLE,
    })),
    sites: vi.fn<NetlifyDestinationApi["sites"]>(async () => ({
      status: "listed",
      sites: [SHOP, STAGING],
    })),
    ...overrides,
  };
}

function setUp(netlify = fakeNetlify(), editing?: NetlifyDestinationDialogProps["editing"]) {
  const onSave = vi.fn();
  render(
    <NetlifyDestinationDialog
      open
      netlify={netlify}
      {...(editing === undefined ? {} : { editing })}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  const user = userEvent.setup({ delay: null });
  const field = (name: string) => screen.getByLabelText(name, { exact: true });
  const save = () => user.click(screen.getByRole("button", { name: "Save Destination" }));
  const connect = async (token: string) => {
    await user.type(field("Personal access token"), token);
    await user.click(screen.getByRole("button", { name: "Connect" }));
  };
  return { netlify, onSave, user, field, save, connect };
}

describe("a Netlify publish destination (4.4b, F-PB-1)", () => {
  it("connects with a pasted token, lists the account's sites, and saves the one chosen", async () => {
    const { netlify, onSave, user, save, connect } = setUp();
    // Nothing to save before signing in.
    await save();
    expect(
      await screen.findByText("Sign in to Netlify, or paste a token and choose Connect."),
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    await connect(" nfp_secret-token ");
    expect(netlify.signInWithToken).toHaveBeenCalledWith("nfp_secret-token");
    expect(await screen.findByText("Signed in to Netlify.")).toBeTruthy();
    expect(netlify.sites).toHaveBeenCalledWith({ handle: HANDLE });
    await user.selectOptions(await screen.findByLabelText("Netlify site"), SHOP.id);
    await save();

    // Named for its site when left unnamed; its sign-in by the handle main holds it under.
    expect(onSave).toHaveBeenCalledWith({
      name: "rosas-bakery",
      site: SHOP,
      signIn: { handle: HANDLE },
    });
  });

  it("offers Sign In with Netlify only once the app can, and signs in in the browser", async () => {
    setUp();
    expect(screen.queryByRole("button", { name: "Sign In with Netlify" })).toBeNull();
    cleanup();

    const { netlify, user } = setUp(fakeNetlify({ canSignIn: true }));
    await user.click(screen.getByRole("button", { name: "Sign In with Netlify" }));

    expect(netlify.signIn).toHaveBeenCalled();
    expect(await screen.findByText("Signed in to Netlify.")).toBeTruthy();
  });

  it("can stop waiting for the browser, saying nothing more when it's cancelled", async () => {
    let answer: (result: { status: "failed"; reason: "cancelled" }) => void = () => undefined;
    const netlify = fakeNetlify({
      canSignIn: true,
      signIn: vi.fn(() => new Promise((resolve) => (answer = resolve))),
    });
    netlify.cancelSignIn.mockImplementation(() =>
      answer({ status: "failed", reason: "cancelled" }),
    );
    const { user } = setUp(netlify);
    await user.click(screen.getByRole("button", { name: "Sign In with Netlify" }));
    expect(
      await screen.findByText(
        "Approve Webforge in the browser page that opened, then come back here.",
      ),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancel Sign-In" }));

    expect(netlify.cancelSignIn).toHaveBeenCalled();
    await screen.findByRole("button", { name: "Sign In with Netlify" });
    expect(screen.queryByText("Signing in was cancelled.")).toBeNull();
    expect(screen.queryByText(/Approve Webforge/)).toBeNull();
  });

  it("makes a new site, named or left for Netlify to name", async () => {
    const { onSave, user, field, save, connect } = setUp();
    await connect("nfp_token");
    await user.selectOptions(await screen.findByLabelText("Netlify site"), "new");
    await user.type(field("New site's name"), " rosas-shop ");
    await user.type(field("Name"), "The shop");
    await save();

    expect(onSave).toHaveBeenCalledWith({
      name: "The shop",
      site: { create: "rosas-shop" },
      signIn: { handle: HANDLE },
    });
  });

  it("asks for a site once signed in", async () => {
    const { onSave, save, connect } = setUp();
    await connect("nfp_token");
    await screen.findByLabelText("Netlify site");
    await save();

    expect(await screen.findByText("Choose a Netlify site, or a new one.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps the sign-in saved for the destination it edits, listing its sites with it", async () => {
    const { netlify, onSave, save } = setUp(fakeNetlify(), {
      id: SAVED,
      name: "Rosa's shop",
      siteId: SHOP.id,
      signedIn: true,
    });

    expect(netlify.sites).toHaveBeenCalledWith({ saved: SAVED });
    const picker = (await screen.findByLabelText("Netlify site")) as HTMLSelectElement;
    expect(picker.value).toBe(SHOP.id);
    await save();

    expect(onSave).toHaveBeenCalledWith({
      name: "Rosa's shop",
      site: SHOP,
      signIn: { keep: true },
    });
    expect(netlify.signInWithToken).not.toHaveBeenCalled();
  });

  it("warns that visitors must log in for a site with visitor access on (ADR 0006)", async () => {
    const { user, connect } = setUp();
    await connect("nfp_token");
    await user.selectOptions(await screen.findByLabelText("Netlify site"), SHOP.id);
    expect(screen.queryByText("Visitors have to log in to see this site")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Netlify site"), STAGING.id);

    expect(screen.getByRole("alert").textContent).toContain(
      "Visitors have to log in to see this site",
    );
  });

  it("says why it couldn't sign in or list the sites, in Test Connection's words", async () => {
    const refused = setUp(
      fakeNetlify({
        signInWithToken: vi.fn(async () => ({ status: "failed", reason: "unauthorized" }) as const),
      }),
    );
    await refused.connect("nfp_wrong");
    expect(
      await screen.findByText(
        "Netlify didn't accept the sign-in. Check the token, or make a new one on Netlify.",
      ),
    ).toBeTruthy();
    expect(refused.netlify.sites).not.toHaveBeenCalled();
    cleanup();

    const offline = setUp(
      fakeNetlify({
        sites: vi.fn(async () => ({ status: "failed", reason: "network" }) as const),
      }),
    );
    await offline.connect("nfp_token");
    expect((await screen.findByRole("alert")).textContent).toContain("Netlify couldn't be reached");
  });
});
