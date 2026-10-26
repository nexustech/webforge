/** Every class the site's styles support, and the variants that go before them (#276). */
export type ClassCatalogue = {
  readonly classes: readonly string[];
  readonly variants: readonly string[];
};

/** The most suggestions the field shows at once: enough to choose from, quick to draw. */
export const MAX_SUGGESTIONS = 50;

/**
 * `word` split at its last `:` outside brackets: the variants before it (`md:hover:`) and the class
 * after. A colon in an arbitrary value or variant (`bg-[url(https://…)]`, `[&:hover]:`) isn't one.
 */
export function splitVariants(word: string): { readonly prefix: string; readonly part: string } {
  let at = -1;
  let depth = 0;
  for (const [index, letter] of [...word].entries()) {
    if (letter === "[") depth += 1;
    else if (letter === "]") depth = Math.max(0, depth - 1);
    else if (letter === ":" && depth === 0) at = index;
  }
  return at === -1
    ? { prefix: "", part: word }
    : { prefix: word.slice(0, at + 1), part: word.slice(at + 1) };
}

/**
 * How well `candidate` matches what's typed, `part`, when it doesn't start with it: starting with
 * the same letter, and with the others in order close behind (`bgpr` in `bg-primary`). Scored by
 * the letters skipped, lower better; undefined when it doesn't match so (`btn` isn't in
 * `bg-primary-content`, its letters too far apart).
 */
function fuzzyScore(candidate: string, part: string): number | undefined {
  if (part.length < 2 || candidate.charAt(0) !== part.charAt(0)) return undefined;
  let from = 1;
  let gaps = 0;
  for (const letter of part.slice(1)) {
    const at = candidate.indexOf(letter, from);
    if (at === -1) return undefined;
    gaps += at - from;
    from = at + 1;
  }
  return gaps <= part.length * 2 ? gaps + candidate.length / 100 : undefined;
}

/**
 * The suggestions for `word`, the class being typed (#276), best first and at most
 * {@link MAX_SUGGESTIONS}: the classes that start with it, shortest first, then those it matches
 * fuzzily, closest first. Variants typed before it (`md:`, `hover:`) stay in front of each, and while
 * no class part is typed yet, the variants that start with it are offered too (`ho` → `hover:`).
 */
export function suggestClasses(catalogue: ClassCatalogue, word: string): string[] {
  const { prefix, part } = splitVariants(word);
  if (part === "") return [];
  const starting: string[] = [];
  const fuzzy: { readonly name: string; readonly score: number }[] = [];
  for (const name of catalogue.classes) {
    if (name === part) continue;
    if (name.startsWith(part)) {
      starting.push(name);
    } else if (starting.length < MAX_SUGGESTIONS) {
      const score = fuzzyScore(name, part);
      if (score !== undefined) fuzzy.push({ name, score });
    }
  }
  starting.sort((a, b) => a.length - b.length || a.localeCompare(b));
  fuzzy.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  const variants = catalogue.variants
    .filter((variant) => variant.startsWith(part) && variant !== part)
    .map((variant) => `${variant}:`);
  return [...variants, ...starting, ...fuzzy.map((each) => each.name)]
    .slice(0, MAX_SUGGESTIONS)
    .map((name) => `${prefix}${name}`);
}

/** The edit distance between `a` and `b`: how many letters to add, remove or change. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(
        Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      );
    }
    previous = row;
  }
  return previous[b.length] ?? 0;
}

/**
 * CSS's own words, as people type them, and Tailwind's short names for them: `padding-4` is `p-4`.
 * Matched with a letter or two wrong (`pading-4`).
 */
const CSS_WORDS: Readonly<Record<string, string>> = {
  padding: "p",
  margin: "m",
  width: "w",
  height: "h",
  background: "bg",
  color: "text",
  colour: "text",
  "font-size": "text",
  "border-radius": "rounded",
  "line-height": "leading",
  "letter-spacing": "tracking",
};

/** `part` with its CSS word (`pading`) in Tailwind's name (`p`), if it starts with one. */
function shortened(part: string): string | undefined {
  for (const [word, short] of Object.entries(CSS_WORDS)) {
    const head = part.slice(0, word.length + 1);
    const cut = head.lastIndexOf("-");
    if (cut <= 0) continue;
    if (distance(head.slice(0, cut), word) <= 2) return `${short}${part.slice(cut)}`;
  }
  return undefined;
}

/**
 * The supported class closest to `name`, a class that makes no style (`pading-4` → `p-4`), with
 * the same variants: CSS's own words in Tailwind's short names first, then the class a letter or
 * two away; undefined when none is close (more than a third of it different).
 */
export function closestClass(catalogue: ClassCatalogue, name: string): string | undefined {
  const { prefix, part } = splitVariants(name);
  const short = shortened(part);
  if (short !== undefined && catalogue.classes.includes(short)) return `${prefix}${short}`;
  let best: { readonly name: string; readonly distance: number } | undefined;
  const most = Math.max(1, Math.floor(part.length / 3));
  for (const candidate of catalogue.classes) {
    if (Math.abs(candidate.length - part.length) > most) continue;
    const apart = distance(part, candidate);
    if (apart <= most && (best === undefined || apart < best.distance)) {
      best = { name: candidate, distance: apart };
    }
  }
  return best === undefined ? undefined : `${prefix}${best.name}`;
}
