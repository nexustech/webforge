// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantApi, AssistantStatus } from "../../shared/ipc/assistant.js";
import { FAKE_STATUS } from "./fake-assistant.js";
import { ProviderSection } from "./ProviderSection.js";

afterEach(cleanup);

/** How a sign-in step came out. */
type Outcome = Awaited<ReturnType<AssistantApi["signIn"]>>;

/** A promise the test settles. */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

function shown(provider: AssistantStatus["provider"] = { kind: "openrouter", signedIn: false }) {
  const status: AssistantStatus = { ...FAKE_STATUS, provider };
  const api = {
    update: vi.fn<AssistantApi["update"]>(async () => status),
    signIn: vi.fn<AssistantApi["signIn"]>(),
    finishSignIn: vi.fn<AssistantApi["finishSignIn"]>(),
    cancelSignIn: vi.fn<AssistantApi["cancelSignIn"]>(async () => undefined),
    setKey: vi.fn<AssistantApi["setKey"]>(),
  };
  render(<ProviderSection status={status} api={api} onStatus={vi.fn()} />);
  return { api, user: userEvent.setup({ delay: null }) };
}

describe("where the assistant's requests go (ADR 0026 §2–§3)", () => {
  it("signs in to OpenRouter through the browser, waiting with Cancel meanwhile", async () => {
    const { api, user } = shown();
    const start = deferred<Outcome>();
    api.signIn.mockReturnValue(start.promise);

    await user.click(screen.getByRole("button", { name: "Sign In with OpenRouter…" }));
    expect(api.signIn).toHaveBeenCalledWith("browser");
    expect(screen.getByRole("status").textContent).toBe("Finish signing in in your browser.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.cancelSignIn).toHaveBeenCalledOnce();

    start.settle({ status: "cancelled" });
    expect(await screen.findByText("Sign-in cancelled.")).toBeDefined();
  });

  it("signs in with a pasted code, asking again after a wrong one", async () => {
    const { api, user } = shown();
    const start = deferred<Outcome>();
    api.signIn.mockReturnValue(start.promise);
    api.finishSignIn.mockResolvedValueOnce({ status: "refused" });
    api.finishSignIn.mockResolvedValueOnce({ status: "signed-in" });

    await user.click(screen.getByRole("button", { name: "Sign In with a Code…" }));
    const field = screen.getByRole("textbox", { name: "The code OpenRouter shows" });
    await user.type(field, "wrong{Enter}");
    expect(await screen.findByText(/That wasn't accepted/)).toBeDefined();
    expect(screen.getByRole("textbox", { name: "The code OpenRouter shows" })).toBeDefined();

    await user.clear(field);
    await user.type(field, "right{Enter}");
    expect(api.finishSignIn).toHaveBeenLastCalledWith("right");
    start.settle({ status: "signed-in" });
    expect(await screen.findByText("Signed in.")).toBeDefined();
  });

  it("changes the provider in main, and takes another server by its address", async () => {
    const { api, user } = shown();

    await user.click(screen.getByRole("radio", { name: /Ollama on this computer/ }));
    expect(api.update).toHaveBeenCalledWith({ provider: { kind: "ollama" } });

    await user.click(screen.getByRole("radio", { name: /Another server/ }));
    const use = screen.getByRole("button", { name: "Use This Server" });
    expect((use as HTMLButtonElement).disabled).toBe(true);
    await user.type(
      screen.getByRole("textbox", { name: "Server address" }),
      "https://ai.example.org/v1",
    );
    await user.click(use);
    expect(api.update).toHaveBeenLastCalledWith({
      provider: { kind: "server", baseUrl: "https://ai.example.org/v1" },
    });
  });

  it("saves another server's key, saying why it wasn't taken", async () => {
    const { api, user } = shown({
      kind: "server",
      baseUrl: "http://ai.example.org/v1",
      hasKey: false,
    });
    api.setKey.mockResolvedValue({ status: "keychain-unavailable" });

    await user.type(
      screen.getByLabelText("Key for this server, if it needs one"),
      "sk-test{Enter}",
    );
    expect(api.setKey).toHaveBeenCalledWith("sk-test");
    expect(await screen.findByText(/can't keep the key safely/)).toBeDefined();
  });
});
