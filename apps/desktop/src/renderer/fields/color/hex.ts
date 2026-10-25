import type { Oklch } from "@webforge/model";
import { oklchToSrgb } from "@webforge/themes";

/** `color` as the six lower-case hex digits a colour is typed and stored in: `#1f6feb`. */
export function hexOf(color: Oklch): string {
  const { r, g, b } = oklchToSrgb(color);
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
