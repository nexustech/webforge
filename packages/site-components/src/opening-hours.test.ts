import { describe, expect, it } from "vitest";
import { daysText, openingHoursLines, timeText } from "./opening-hours.js";

describe("opening hours' days (2.8)", () => {
  it.each([
    [["mon"], "Monday"],
    [["sat", "sun"], "Saturday and Sunday"],
    [["tue", "wed", "thu", "fri"], "Tuesday to Friday"],
    [["mon", "wed", "fri"], "Monday, Wednesday and Friday"],
    [["mon", "tue", "wed", "fri", "sat"], "Monday to Wednesday, Friday and Saturday"],
    [["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "Monday to Sunday"],
    [["fri", "tue", "thu", "wed"], "Tuesday to Friday"],
    [[], ""],
  ] as const)("reads %j as %j, in the week's order", (days, text) => {
    expect(daysText(days)).toBe(text);
  });

  it("lists each group of days with its hours, in the order they were entered", () => {
    expect(
      openingHoursLines([
        { days: ["sat", "sun"], opens: "08:00", closes: "13:00" },
        { days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" },
      ]),
    ).toEqual([
      {
        days: "Saturday and Sunday",
        opens: "08:00",
        closes: "13:00",
        opensText: "08:00",
        closesText: "13:00",
      },
      {
        days: "Tuesday to Friday",
        opens: "07:00",
        closes: "15:00",
        opensText: "07:00",
        closesText: "15:00",
      },
    ]);
  });

  it("writes the times as the site's language does, keeping what's stored for the markup", () => {
    expect(timeText("09:00", "en-GB")).toBe("9:00");
    expect(timeText("17:30", "en-GB")).toBe("17:30");
    // Intl puts a narrow no-break space before AM and PM.
    expect(timeText("09:00", "en-US")).toMatch(/^9:00\s?AM$/u);
    expect(timeText("17:30", "en-US")).toMatch(/^5:30\s?PM$/u);
    expect(timeText("17:30", undefined)).toBe("17:30");
    expect(timeText("17:30", "not a language")).toBe("17:30");

    const [line] = openingHoursLines([{ days: ["mon"], opens: "08:00", closes: "13:00" }], "en-US");
    expect(line).toMatchObject({ opens: "08:00", closes: "13:00" });
    expect(line?.closesText).toMatch(/^1:00\s?PM$/u);
  });
});
