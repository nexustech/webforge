/**
 * A plain square of `colour`, in place of a Media thumbnail: stories make no requests (C8). For
 * the form's stories only. `transparent` is a picture still loading: its box's fill shows (#1452).
 */
export const swatch = (colour: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="${colour}"/></svg>`,
  )}`;
