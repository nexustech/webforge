import { graphemes } from "@webforge/model";
import { cn } from "../../lib/cn.js";

/** The characters a cut name keeps before its extension, so two "…e.jpg"s still differ (#1452). */
const KEPT_BEFORE_EXTENSION = 3;

/** The longest extension kept whole: `.jpeg`, `.webp`. A longer "extension" is part of the name. */
const LONGEST_EXTENSION = 5;

/**
 * A file's name in two parts that add up to it exactly (#1452): `start`, which is cut short when
 * the name doesn't fit, and `end`, which always shows, its extension and the few characters before
 * it. A name whose dot is its first character (`.hidden`), or whose part after the last dot is
 * long or has a space, has no extension: its end is its last few characters. Never split inside a
 * character as a reader counts them, so an emoji or an accented letter isn't cut in two.
 */
export function fileNameParts(name: string): { readonly start: string; readonly end: string } {
  const characters = graphemes(name);
  const dot = characters.lastIndexOf(".");
  const extension = characters.slice(dot + 1);
  const hasExtension =
    dot > 0 &&
    extension.length > 0 &&
    extension.length <= LONGEST_EXTENSION &&
    !extension.some((each) => /\s/.test(each));
  const from = Math.max(0, (hasExtension ? dot : characters.length) - KEPT_BEFORE_EXTENSION);
  return { start: characters.slice(0, from).join(""), end: characters.slice(from).join("") };
}

/**
 * A file's name on one line (#1452): when it doesn't fit, cut in the middle, keeping its extension
 * and the characters before it in view ("riverside-te…ast.jpg"), as a name broken mid-word or cut
 * at its end ("riverside-terr…") loses what tells a logo's PNG from its JPEG. CSS only: the start
 * shrinks with an ellipsis, the end doesn't. `WithTooltip whenCut` around it shows it whole when
 * it's cut, as it finds the start's `truncate`.
 *
 * The two parts are side by side boxes, which a screen reader would read with a space between
 * them ("riverside-terrace-break ast.jpg"), so they're hidden from it and the whole name is said
 * once, as it is. They can't be selected, so a copy of it is the name, once.
 */
export function FileName({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string;
}) {
  const { start, end } = fileNameParts(name);
  return (
    <span className={cn("relative flex min-w-0 max-w-full", className)}>
      <span aria-hidden className="flex min-w-0 select-none">
        {/* `whitespace-pre`: a space either side of the cut isn't lost at a part's edge. */}
        <span className="truncate whitespace-pre">{start}</span>
        <span className="shrink-0 whitespace-pre">{end}</span>
      </span>
      <span className="sr-only">{name}</span>
    </span>
  );
}
