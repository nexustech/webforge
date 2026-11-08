import nodes from "lucide-static/icon-nodes.json" with { type: "json" };
import { createElement } from "react";

/** One drawn part of an icon: an SVG element and its attributes. */
type IconNode = readonly [tag: string, attributes: Readonly<Record<string, string>>];

const ICON_NODES = nodes as unknown as Readonly<Record<string, readonly IconNode[]>>;

/**
 * Lucide's icons (F-ED-22, PH2-4: `lucide-static`, ISC) by name ("arrow-right"), in order. The
 * export draws them as inline SVG (C8), so a site needs no icon font and makes no request.
 */
export const ICON_NAMES: readonly string[] = Object.keys(ICON_NODES);

/**
 * Icons Lucide has renamed, by the name a site file may hold (lucide-static 1.59 to 1.70, #831):
 * Lucide's own icon font keeps each old name on its new one's code point, and `copyright` became
 * `circle-letter-c`, redrawn. A site saved before keeps its icons. Lucide's icon list holds no
 * aliases, so a Lucide update checks its removed names against this table.
 */
const RENAMED_ICONS: Readonly<Record<string, string>> = {
  "archive-restore": "archive-arrow-up",
  "badge-alert": "badge-exclamation-point",
  "battery-warning": "battery-exclamation-point",
  bold: "letter-b",
  "book-alert": "book-exclamation-point",
  "circle-alert": "circle-exclamation-point",
  "circle-parking-off": "circle-letter-p-off",
  "circle-parking": "circle-letter-p",
  "clock-alert": "clock-exclamation-point",
  "cloud-alert": "cloud-exclamation-point",
  copyright: "circle-letter-c",
  heading: "letter-h",
  "mail-warning": "mail-exclamation-point",
  "message-circle-warning": "message-circle-exclamation-point",
  "message-square-warning": "message-square-exclamation-point",
  "octagon-alert": "octagon-exclamation-point",
  "search-alert": "search-exclamation-point",
  "shield-alert": "shield-exclamation-point",
  "square-m": "square-letter-m",
  "square-parking-off": "square-letter-p-off",
  "square-parking": "square-letter-p",
  "triangle-alert": "triangle-exclamation-point",
};

/**
 * The Lucide icon `name` stands for, by its current name: itself, or what Lucide renamed it to.
 * `undefined` for anything else, which draws nothing.
 */
export function iconNameOf(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const current = Object.hasOwn(RENAMED_ICONS, name) ? RENAMED_ICONS[name] : name;
  return current !== undefined && Object.hasOwn(ICON_NODES, current) ? current : undefined;
}

/** Whether `name` is one of Lucide's icons, or one it renamed: anything else draws nothing. */
export const isIconName = (name: unknown): name is string => iconNameOf(name) !== undefined;

/**
 * Lucide icon `name` as inline SVG, as wide and high as its text unless `className` sizes it, in
 * the text's colour. Hidden from screen readers: say what an icon means in text beside it, or with
 * `label`, which names it for them instead. Nothing for a name Lucide doesn't have.
 */
export function LucideIcon({
  name,
  className,
  label,
}: {
  readonly name: string;
  readonly className?: string | undefined;
  readonly label?: string | undefined;
}) {
  const drawn = iconNameOf(name);
  if (drawn === undefined) return null;
  // The parts never change order: their place is their key.
  const parts = (ICON_NODES[drawn] ?? []).map(([tag, attributes], index) =>
    createElement(tag, { ...attributes, key: index }),
  );
  const drawing = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: className ?? "size-[1em]",
  } as const;
  const named = label?.trim() ?? "";
  return named === "" ? (
    <svg {...drawing} aria-hidden="true">
      {parts}
    </svg>
  ) : (
    <svg {...drawing} role="img" aria-label={named}>
      {parts}
    </svg>
  );
}
