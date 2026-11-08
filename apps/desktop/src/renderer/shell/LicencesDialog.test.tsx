// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LicencesResult } from "../../shared/ipc/app.js";
import { AboutDialog } from "./AboutDialog.js";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { LicencesDialog } from "./LicencesDialog.js";
import { OpenSourceLicences } from "./OpenSourceLicences.js";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@webforge/editor-ui", async (original) => ({
  ...(await original<typeof import("@webforge/editor-ui")>()),
  toast,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const LISTED: LicencesResult = {
  status: "listed",
  packages: [
    {
      name: "@fontsource-variable/inter",
      version: "5.2.8",
      licence: "OFL-1.1",
      homepage: "https://fontsource.org/fonts/inter",
      text: "SIL OPEN FONT LICENSE Version 1.1",
    },
    { name: "react", version: "19.2.0", licence: "MIT", text: "MIT License\n\nCopyright Meta" },
    { name: "react-remove-scroll-bar", version: "2.3.8", licence: "MIT" },
  ],
};

function api(result: LicencesResult = LISTED, chromium = true) {
  return {
    listLicences: vi.fn(async () => result),
    openChromiumLicences: vi.fn(async () => chromium),
  };
}

const list = () => screen.getByRole("list", { name: t("licences.list") });

describe("Open-Source Licences (5.3)", () => {
  it("lists every package with its version and licence, and its licence's text once opened", async () => {
    const licences = api();
    render(<LicencesDialog open onOpenChange={vi.fn()} licences={licences} />);

    await screen.findByRole("list", { name: t("licences.list") });
    const rows = within(list()).getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("summary")?.textContent)).toEqual([
      "@fontsource-variable/inter 5.2.8OFL-1.1",
      "react 19.2.0MIT",
      "react-remove-scroll-bar 2.3.8MIT",
    ]);
    expect(screen.getByText("Showing 3 of 3")).toBeTruthy();
    // Not drawn until it's opened.
    expect(screen.queryByText(/Copyright Meta/)).toBeNull();

    const react = rows[1]?.querySelector("details");
    if (react === undefined || react === null) throw new Error("no details");
    act(() => {
      react.open = true;
      react.dispatchEvent(new Event("toggle"));
    });
    expect(within(react).getByText(/Copyright Meta/)).toBeTruthy();

    const bare = rows[2]?.querySelector("details");
    if (bare === undefined || bare === null) throw new Error("no details");
    act(() => {
      bare.open = true;
      bare.dispatchEvent(new Event("toggle"));
    });
    expect(within(bare).getByText(t("licences.noText", { licence: "MIT" }))).toBeTruthy();
  });

  it("finds a package by its name or its licence", async () => {
    render(<LicencesDialog open onOpenChange={vi.fn()} licences={api()} />);
    const search = await screen.findByLabelText(t("licences.search"));

    await userEvent.type(search, "ofl");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Showing 1 of 3")).toBeTruthy();

    await userEvent.clear(search);
    await userEvent.type(search, " REACT ");
    expect(within(list()).getAllByRole("listitem")).toHaveLength(2);
  });

  it("says when the list couldn't be read", async () => {
    render(<LicencesDialog open onOpenChange={vi.fn()} licences={api({ status: "failed" })} />);
    expect(await screen.findByText(t("licences.failed"))).toBeTruthy();
  });

  it("opens Chromium's licences, and says when it couldn't", async () => {
    const licences = api(LISTED, false);
    render(<LicencesDialog open onOpenChange={vi.fn()} licences={licences} />);
    await userEvent.click(screen.getByRole("button", { name: t("licences.chromium") }));
    expect(licences.openChromiumLicences).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(t("licences.chromiumFailed")));
  });

  it("is Help → Open-Source Licences, and About opens it too", async () => {
    const registry = createCommandRegistry({ mac: false });
    const licences = api();
    render(
      <CommandRegistryProvider registry={registry}>
        <AboutDialog info={{ name: "Webforge", version: "1.0.0" }} />
        <OpenSourceLicences licences={licences} />
      </CommandRegistryProvider>,
    );
    expect(registry.get(COMMAND_IDS.licences)).toMatchObject({
      label: t("command.licences"),
      menu: "help",
    });
    expect(licences.listLicences).not.toHaveBeenCalled();

    act(() => {
      registry.run(COMMAND_IDS.about);
    });
    await userEvent.click(await screen.findByRole("button", { name: t("command.licences") }));

    expect(await screen.findByRole("dialog", { name: t("licences.title") })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Webforge" })).toBeNull();
    expect(licences.listLicences).toHaveBeenCalledOnce();
  });
});
