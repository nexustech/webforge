export function chrome(element: HTMLElement, text: string): void {
  element.setAttribute("title", text);
  element.title = text;
}
