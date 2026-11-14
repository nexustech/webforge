/**
 * A small line icon for a component's own buttons (a carousel's, the lightbox's, an embed's, the
 * announcement's close), drawn inline so the site needs no icon font (C8, #988): `path` stroked in
 * the text's colour, `size` pixels square, hidden from screen readers as its button is labelled.
 */
export function StrokeIcon({ path, size = 20 }: { readonly path: string; readonly size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={String(size)}
      height={String(size)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
