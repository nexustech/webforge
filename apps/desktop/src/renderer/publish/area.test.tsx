// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { fakePreloadApi } from "../testing/preload.js";
import { publishArea } from "./area.js";

afterEach(cleanup);

function setUp() {
  const registries = registriesForTest();
  const windowDialogs = createWindowDialogs();
  const session = sessionWith();
  const api = fakePreloadApi({
    publish: {
      destinations: vi.fn(async () => ({ status: "listed" as const, destinations: [] })),
      saveDestination: vi.fn(async (_session, draft) => ({
        status: "saved" as const,
        destination: {
          id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
          name: draft.name,
          kind: "file-transfer" as const,
          settings: {
            protocol: "ftps" as const,
            host: "ftp.rosasbakery.co.uk",
            user: "rosa",
            folder: "/public_html",
            url: "https://www.rosasbakery.co.uk",
          },
        },
      })),
    },
  });
  // Only what the area uses of the window's context.
  const context = { ...registries, api, session, windowDialogs } as unknown as WindowContext;
  const remove = publishArea.register(context);
  render(<WindowDialogs registry={windowDialogs} />);
  return { registries, session, api, remove };
}

describe("publishArea (4.4a)", () => {
  it("registers Publish… in File, which opens the site's destinations", async () => {
    const { registries, api } = setUp();
    expect(registries.commands.get(COMMAND_IDS.publish)).toMatchObject({
      label: "Publish…",
      menu: "file",
    });

    act(() => {
      registries.commands.run(COMMAND_IDS.publish);
    });

    expect(await screen.findByRole("dialog", { name: "Publish" })).toBeTruthy();
    expect(api.publish.destinations).toHaveBeenCalledOnce();
  });

  it("fills the site's web address from a destination saved with one, as one undo step", async () => {
    const { registries, session } = setUp();
    const user = userEvent.setup({ delay: null });
    act(() => {
      registries.commands.run(COMMAND_IDS.publish);
    });
    await user.click(await screen.findByRole("button", { name: "Add Destination" }));
    const form = within(await screen.findByRole("dialog", { name: "Publish to your web host" }));
    await user.type(form.getByLabelText("Host", { exact: true }), "ftp.rosasbakery.co.uk");
    await user.type(form.getByLabelText("User name", { exact: true }), "rosa");
    await user.type(form.getByLabelText("Password", { exact: true }), "test-only-password");
    await user.click(form.getByRole("button", { name: "Save" }));

    await vi.waitFor(() =>
      expect(session.history.document.getState().settings.address.url).toBe(
        "https://www.rosasbakery.co.uk",
      ),
    );
    expect(session.history.state.getState().entries.at(-1)?.label).toBe(
      "Changed Site Settings: Web address",
    );
  });

  it("removes its command and dialog when unregistered", () => {
    const { registries, remove } = setUp();
    remove?.();
    expect(registries.commands.get(COMMAND_IDS.publish)).toBeUndefined();
  });
});
