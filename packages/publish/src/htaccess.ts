/** The Apache host's file of rules for the site's folder, which publishing may write into. */
export const HTACCESS_FILE = ".htaccess";

/** The first line of the block Webforge writes in a host's `.htaccess`, which finds it again. */
export const HTACCESS_BEGIN = "# BEGIN Webforge redirects";

/** The block's last line. */
export const HTACCESS_END = "# END Webforge redirects";

/** What the block says of itself, to whoever opens the file. */
const ABOUT = [
  "# Old addresses of pages, sent on to where the pages are now. Webforge writes this block each",
  "# time it publishes; the rest of this file is yours, and stays as it is.",
];

/**
 * A host's `.htaccess`, `existing` (`undefined` when it has none), with Webforge's block holding
 * `rules` (5.15, CC-7), or without the block when `rules` is `undefined`: the person turned it off,
 * or the site has no old addresses now. Only the block is ever changed: a block already there is
 * replaced where it is, and a new one goes first, so its redirects come before rules that would
 * answer every address (a CMS's). The file's own line endings are kept. `null` when nothing is
 * left, from a file that held only the block. A file with a broken block, its start without its
 * end, or the end first, is left as it is (`existing`): its rest can't be told from the block.
 */
export function withRedirectRules(
  existing: string | undefined,
  rules: string | undefined,
): string | undefined | null {
  const text = existing ?? "";
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const begin = text.indexOf(HTACCESS_BEGIN);
  const end = text.indexOf(HTACCESS_END);
  if ((begin === -1) !== (end === -1) || end < begin) return existing;
  const block =
    rules === undefined
      ? undefined
      : [HTACCESS_BEGIN, ...ABOUT, ...rules.split("\n"), HTACCESS_END].join(newline);
  if (begin === -1) {
    if (block === undefined) return existing;
    return text === "" ? `${block}${newline}` : `${block}${newline}${newline}${text}`;
  }
  const before = text.slice(0, begin);
  let after = text.slice(end + HTACCESS_END.length);
  if (block !== undefined) return `${before}${block}${after}`;
  // The block's own line ending, and the blank line written after it.
  if (after.startsWith(newline)) after = after.slice(newline.length);
  if (before === "" && after.startsWith(newline)) after = after.slice(newline.length);
  const rest = `${before}${after}`;
  return rest.trim() === "" ? null : rest;
}
