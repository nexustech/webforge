/**
 * What a screen reader says of `element`: its text, without what's hidden from it. A file's name
 * cut in the middle (`FileName`, #1452) draws its two parts hidden and says the whole name once,
 * so `textContent` has it twice.
 */
export function spokenText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent ?? "";
}
