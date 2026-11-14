// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantApi, AssistantModel, AssistantStatus } from "../../shared/ipc/assistant.js";
import { FAKE_MODEL, FAKE_STATUS } from "./fake-assistant.js";
import { ModelSection } from "./ModelSection.js";

afterEach(cleanup);

const PRICEY: AssistantModel = {
  ...FAKE_MODEL,
  id: "example/model-large",
  name: "Example Large",
  tested: false,
  perReplyUsd: 2.5,
  pricey: true,
};

function shown(status: AssistantStatus = FAKE_STATUS, models = [FAKE_MODEL, PRICEY]) {
  const api = {
    models: vi.fn<AssistantApi["models"]>(async () => ({ status: "ok", models })),
    update: vi.fn<AssistantApi["update"]>(async () => status),
    setKey: vi.fn<AssistantApi["setKey"]>(async () => ({ status: "signed-in" })),
  };
  render(<ModelSection status={status} api={api} onStatus={vi.fn()} />);
  return { api, user: userEvent.setup({ delay: null }) };
}

describe("which model answers (AIA-8, ADR 0026 §2)", () => {
  it("lists the models with their rough cost and the tested ones marked", async () => {
    shown();
    const list = await screen.findByRole("combobox", { name: "The model that answers" });

    expect([...(list as HTMLSelectElement).options].map((option) => option.textContent)).toEqual([
      "Example Medium, Example AI · about $0.30 a reply · tested",
      "Example Large, Example AI · about $2.50 a reply",
    ]);
  });

  it("asks once before a costlier model, and changes nothing if cancelled", async () => {
    const { api, user } = shown();
    const list = await screen.findByRole("combobox", { name: "The model that answers" });

    await user.selectOptions(list, "example/model-large");
    const ask = within(screen.getByRole("alertdialog", { name: "Use a costlier model?" }));
    expect(ask.getByText(/about \$2\.50 a reply/)).toBeDefined();
    await user.click(ask.getByRole("button", { name: "Cancel" }));
    expect(api.update).not.toHaveBeenCalled();

    await user.selectOptions(list, "example/model-large");
    await user.click(screen.getByRole("button", { name: "Use This Model" }));
    expect(api.update).toHaveBeenCalledWith({ modelId: "example/model-large" });
  });

  it("allows models that may keep requests only after a warning (AIA-7)", async () => {
    const { api, user } = shown();
    await user.click(screen.getByText("Advanced"));

    await user.click(screen.getByRole("checkbox", { name: /Allow models that may keep requests/ }));
    expect(api.update).not.toHaveBeenCalled();
    const warning = within(
      screen.getByRole("alertdialog", { name: "Allow models that may keep requests?" }),
    );
    expect(warning.getByText(/use it to train its models/)).toBeDefined();
    await user.click(warning.getByRole("button", { name: "Allow Them" }));
    expect(api.update).toHaveBeenCalledWith({ allowRetainingModels: true });
  });

  it("turns Review before applying on and off at once (AIA-5, 6.9e)", async () => {
    const { api, user } = shown();
    await user.click(screen.getByText("Advanced"));
    const review = screen.getByRole("checkbox", { name: /Review changes before they're made/ });
    expect((review as HTMLInputElement).checked).toBe(false);
    await user.click(review);
    expect(api.update).toHaveBeenCalledWith({ reviewBeforeApplying: true });
  });

  it("takes an OpenRouter key pasted instead of signing in (AIA-1)", async () => {
    const { api, user } = shown();
    await user.click(screen.getByText("Advanced"));

    await user.type(
      screen.getByLabelText("An OpenRouter key, instead of signing in"),
      "sk-or-1{Enter}",
    );
    expect(api.setKey).toHaveBeenCalledWith("sk-or-1");
    expect(await screen.findByText("Signed in.")).toBeDefined();
  });

  it("reads the list again for a new server address, never offering the old one's", async () => {
    const at = (baseUrl: string): AssistantStatus => ({
      ...FAKE_STATUS,
      provider: { kind: "server", baseUrl, hasKey: false },
      model: null,
    });
    let answer: (models: AssistantModel[]) => void = () => undefined;
    const api = {
      models: vi.fn<AssistantApi["models"]>(
        () => new Promise((resolve) => (answer = (models) => resolve({ status: "ok", models }))),
      ),
      update: vi.fn<AssistantApi["update"]>(),
      setKey: vi.fn<AssistantApi["setKey"]>(),
    };
    const { rerender } = render(
      <ModelSection status={at("http://localhost:8080/v1")} api={api} onStatus={vi.fn()} />,
    );
    answer([FAKE_MODEL]);
    expect(await screen.findByRole("combobox", { name: "The model that answers" })).toBeDefined();

    rerender(<ModelSection status={at("http://localhost:9090/v1")} api={api} onStatus={vi.fn()} />);
    expect(api.models).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Loading…")).toBeDefined();
    answer([PRICEY]);
    const list = await screen.findByRole("combobox", { name: "The model that answers" });
    expect([...(list as HTMLSelectElement).options].map((option) => option.value)).toEqual([
      "",
      "example/model-large",
    ]);
  });

  it("shows the model that answers even when the list no longer offers it", async () => {
    const retaining = { ...PRICEY, id: "example/model-keeps", name: "Example Keeps" };
    shown({ ...FAKE_STATUS, model: retaining });
    const list = (await screen.findByRole("combobox", {
      name: "The model that answers",
    })) as HTMLSelectElement;

    expect(list.value).toBe("example/model-keeps");
    expect(list.selectedOptions[0]?.textContent).toMatch(/^Example Keeps/);
  });

  it("asks to sign in first, and words why the list can't be read", async () => {
    const signedOut = shown({ ...FAKE_STATUS, provider: { kind: "openrouter", signedIn: false } });
    expect(screen.getByText("Sign in to OpenRouter to choose a model.")).toBeDefined();
    expect(signedOut.api.models).not.toHaveBeenCalled();
    cleanup();

    const offline = {
      models: vi.fn<AssistantApi["models"]>(async () => ({ status: "offline" })),
      update: vi.fn<AssistantApi["update"]>(),
      setKey: vi.fn<AssistantApi["setKey"]>(),
    };
    render(<ModelSection status={FAKE_STATUS} api={offline} onStatus={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't be reached/);
  });
});
