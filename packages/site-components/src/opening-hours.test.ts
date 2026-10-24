import { describe, expect, it } from "vitest";
import { daysText, openingHoursLines } from "./opening-hours.js";

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
      { days: "Saturday and Sunday", opens: "08:00", closes: "13:00" },
      { days: "Tuesday to Friday", opens: "07:00", closes: "15:00" },
    ]);
  });
});
