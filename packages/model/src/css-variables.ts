/** The longest list {@link cssVariablesUsed} gives: more than any stylesheet a person writes. */
const MAX_VARIABLES = 1000;

/**
 * The custom properties `css` reads (`var(--text-xl)`), each once, sorted (6.8): what the site's
 * own `custom.css` needs the site's styles to define, such as the theme's variables a look moved
 * to CSS uses. Only plain names (`--` and letters, digits, `-` or `_`), so each can go back into
 * CSS as it is.
 */
export function cssVariablesUsed(css: string): string[] {
  const names = new Set<string>();
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  return [...names].sort().slice(0, MAX_VARIABLES);
}
