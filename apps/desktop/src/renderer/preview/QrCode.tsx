import { encode } from "uqr";

/** The quiet zone a reader needs around the code, in modules (ISO 18004: four). */
const QUIET_ZONE = 4;

/** `text` as the dark modules of a QR code: one SVG path, a square for each. */
export function qrPath(text: string): { readonly size: number; readonly path: string } {
  const { data, size } = encode(text, { ecc: "M", border: QUIET_ZONE });
  const squares: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) squares.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return { size, path: squares.join("") };
}

/**
 * `text` as a QR code a phone's camera reads (3.2): dark on white in either appearance, as readers
 * expect, with its quiet zone, drawn crisp at any size.
 */
export function QrCode({
  text,
  label,
  className,
}: {
  readonly text: string;
  /** What it is, for screen readers: "QR code of the preview's address". */
  readonly label: string;
  readonly className?: string;
}) {
  const { size, path } = qrPath(text);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
