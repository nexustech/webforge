// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MonthReadout } from "./MonthReadout.js";
import { money } from "./money.js";

afterEach(cleanup);

describe("money and the month's readout (AIA-8)", () => {
  it("shows cents, and a fraction of a cent so a cheap reply doesn't read as free", () => {
    expect(money(1.25)).toBe("$1.25");
    expect(money(0.0042)).toBe("$0.0042");
    expect(money(0)).toBe("$0.00");
  });

  it("shows the month's spend, warns past 80%, and says when the limit is reached", () => {
    const { rerender } = render(
      <MonthReadout month={{ spentUsd: 1.2, limitUsd: 5, warned: false, reached: false }} />,
    );
    expect(screen.getByText("This month: $1.20 of $5.00")).toBeDefined();

    rerender(<MonthReadout month={{ spentUsd: 4.1, limitUsd: 5, warned: true, reached: false }} />);
    expect(screen.getByText(/over 80% of your limit/)).toBeDefined();

    rerender(<MonthReadout month={{ spentUsd: 5.02, limitUsd: 5, warned: true, reached: true }} />);
    expect(screen.getByText("This month's limit of $5.00 is reached")).toBeDefined();
  });
});
