/** The editor's look as the person chooses it (UI1): dark, light, or the computer's (#1169). */
export type ThemeChoice = "system" | "dark" | "light";

/** The editor's look as shown (UI1); the renderer sets the same name as `data-theme`. */
export type ShownTheme = "dark" | "light";

/**
 * The editor's look as shown for the person's `choice`: the computer's, dark when `computerDark`,
 * while they follow it (#1169). Not a site's theme.
 */
export function shownTheme(choice: ThemeChoice, computerDark: boolean): ShownTheme {
  if (choice !== "system") return choice;
  return computerDark ? "dark" : "light";
}
