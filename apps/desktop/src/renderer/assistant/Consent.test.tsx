// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppConsentDialog, type ConsentReach, SiteConsent } from "./Consent.js";

afterEach(cleanup);

function app(reach: ConsentReach) {
  const onAgree = vi.fn();
  const onCancel = vi.fn();
  render(<AppConsentDialog open reach={reach} onAgree={onAgree} onCancel={onCancel} />);
  const dialog = within(screen.getByRole("dialog", { name: "Turn on the assistant?" }));
  return { dialog, onAgree, onCancel, points: () => dialog.getAllByRole("listitem") };
}

describe("the app's consent (product/14 §5.3, AIA-6)", () => {
  it("names who receives what, who pays, other people's details, turning off and each site", async () => {
    const { dialog, onAgree, points } = app({ kind: "openrouter", maker: "Anthropic" });

    const said = points().map((point) => point.textContent);
    expect(said).toHaveLength(7);
    expect(said[0]).toMatch(/Images and files aren't sent/);
    expect(said[1]).toBe("OpenRouter and Anthropic receive it.");
    expect(said[2]).toMatch(/don't keep your requests or train on them/);
    expect(said[3]).toMatch(/Your own OpenRouter account pays/);
    expect(said[4]).toMatch(/other people's details/);
    expect(said[5]).toMatch(/Turn Off stops it at once/);
    expect(said[6]).toMatch(/each site/);
    await userEvent.click(dialog.getByRole("button", { name: "Turn On" }));
    expect(onAgree).toHaveBeenCalledOnce();
  });

  it("says the model's maker when it isn't known yet, and a named server by its host", () => {
    expect(app({ kind: "openrouter", maker: null }).points()[1]?.textContent).toBe(
      "OpenRouter and the model's maker receive it.",
    );
    cleanup();
    const server = app({ kind: "server", host: "ai.example.org" }).points();
    expect(server[1]?.textContent).toBe(
      "It goes to the server at ai.example.org, which you chose.",
    );
    expect(server.map((point) => point.textContent).join(" ")).not.toMatch(/OpenRouter/);
  });

  it("says nothing leaves this computer for a local model, and asks no site", () => {
    const said = app({ kind: "this-computer" })
      .points()
      .map((point) => point.textContent);

    expect(said).toEqual([
      "Nothing leaves this computer: the model runs on it.",
      expect.stringMatching(/Turn Off stops it at once/),
    ]);
  });

  it("turns nothing on when closed or cancelled", async () => {
    const { dialog, onAgree, onCancel } = app({ kind: "openrouter", maker: "Anthropic" });

    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
    expect(onAgree).not.toHaveBeenCalled();
  });
});

describe("a site's consent (AIA-6, ADR 0026 §4)", () => {
  it("asks once for the site, naming who receives its content, and answers yes or no", async () => {
    const onAnswer = vi.fn();
    render(
      <SiteConsent
        site="Rosie's Bakery"
        reach={{ kind: "openrouter", maker: "Anthropic" }}
        onAnswer={onAnswer}
      />,
    );
    const ask = within(
      screen.getByRole("region", { name: "Use the assistant on Rosie's Bakery?" }),
    );

    expect(ask.getByText(/sent to OpenRouter and Anthropic/)).toBeDefined();
    expect(ask.getByText(/never in the site file/)).toBeDefined();
    await userEvent.click(ask.getByRole("button", { name: "Not Now" }));
    await userEvent.click(ask.getByRole("button", { name: "Use on This Site" }));
    expect(onAnswer.mock.calls).toEqual([[false], [true]]);
  });
});
