// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublishOutcomes, PublishOutcomeDialogs } from "./PublishOutcomeDialogs.js";
import type { LivePublish } from "./publish-flow.js";

const LIVE: LivePublish = {
  operationId: "1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f",
  url: "https://rosas-bakery.netlify.app",
  check: "live",
  uploaded: 14,
  unchanged: 0,
  removed: 0,
  versionSaved: true,
};

afterEach(cleanup);

describe("Your site is live, for a Netlify site visitors can't see (4.4b, #826 review)", () => {
  it("warns once the check finds the publish's site protected, and not for another publish", () => {
    const outcomes = createPublishOutcomes();
    outcomes.showLive(LIVE);
    render(<PublishOutcomeDialogs state={outcomes.state} openLive={vi.fn()} copyLink={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Your site is live" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    // A check for an earlier publish, answering late: not this one's.
    act(() => outcomes.markProtected("9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a"));
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => outcomes.markProtected(LIVE.operationId));
    expect(screen.getByRole("alert").textContent).toContain(
      "Visitors have to log in to see this site",
    );
  });
});
