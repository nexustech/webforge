import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ICON_NAMES, iconNameOf, isIconName, LucideIcon } from "./icons.js";

/** Names Lucide renamed in 1.70 (#831), each with the icon it draws now. */
const RENAMED = [
  ["triangle-alert", "triangle-exclamation-point"],
  ["circle-alert", "circle-exclamation-point"],
  ["heading", "letter-h"],
  ["bold", "letter-b"],
  ["copyright", "circle-letter-c"],
] as const;

describe("Lucide's icons by name (F-ED-22)", () => {
  it("draws an icon saved by a name Lucide has since renamed, as its new one (#831)", () => {
    for (const [old, current] of RENAMED) {
      expect(ICON_NAMES).not.toContain(old);
      expect(ICON_NAMES).toContain(current);
      expect(isIconName(old)).toBe(true);
      expect(iconNameOf(old)).toBe(current);
      expect(renderToStaticMarkup(<LucideIcon name={old} />)).toBe(
        renderToStaticMarkup(<LucideIcon name={current} />),
      );
    }
  });

  it("draws every icon Lucide 1.70 renamed from 1.59", () => {
    const removed = [
      "archive-restore",
      "badge-alert",
      "battery-warning",
      "bold",
      "book-alert",
      "circle-alert",
      "circle-parking-off",
      "circle-parking",
      "clock-alert",
      "cloud-alert",
      "copyright",
      "heading",
      "mail-warning",
      "message-circle-warning",
      "message-square-warning",
      "octagon-alert",
      "search-alert",
      "shield-alert",
      "square-m",
      "square-parking-off",
      "square-parking",
      "triangle-alert",
    ];
    expect(removed.filter((name) => iconNameOf(name) === undefined)).toEqual([]);
  });

  it("keeps a current name as it is, and draws nothing for one Lucide never had", () => {
    expect(iconNameOf("arrow-right")).toBe("arrow-right");
    expect(iconNameOf("no-such-icon")).toBeUndefined();
    expect(iconNameOf(42)).toBeUndefined();
    expect(isIconName("constructor")).toBe(false);
    expect(renderToStaticMarkup(<LucideIcon name="no-such-icon" />)).toBe("");
  });
});
