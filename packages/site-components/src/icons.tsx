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

/** Whether `name` is one of Lucide's icons: anything else in a file draws nothing. */
export const isIconName = (name: unknown): name is string =>
  typeof name === "string" && Object.hasOwn(ICON_NODES, name);

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
  if (!isIconName(name)) return null;
  // The parts never change order: their place is their key.
  const parts = (ICON_NODES[name] ?? []).map(([tag, attributes], index) =>
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
