/** A logo's sizes (HF-1): the Header's logo, and an Image in a Footer column (HF-9). */
export const LOGO_SIZES = ["small", "medium", "large"] as const;
export type LogoSize = (typeof LOGO_SIZES)[number];

/**
 * A logo's height at each size (HF-1): on phones never above the menu's button, so the Header
 * stays one line high there. An Image in a Footer column is as high (HF-9), so a logo there
 * matches the Header's.
 */
export const LOGO_HEIGHTS: Readonly<Record<LogoSize, string>> = {
  small: "h-8",
  medium: "h-10 md:h-12",
  large: "h-10 md:h-16",
};
