// The templates New Site offers, as the E2E tests and the opening perf check make them.

/** Each template: its card's title, the theme it brings, and its home page's heading. */
export const TEMPLATES = [
  { title: "Café / Restaurant", theme: "Bistro", heading: "Good coffee and proper breakfasts" },
  { title: "Salon / Beauty", theme: "Atelier", heading: "Hair and beauty, with time to talk" },
  { title: "Trades", theme: "Workshop", heading: "Safe, tidy electrical work in Leeds" },
  { title: "Consultant", theme: "Meridian", heading: "Clear advice for growing businesses" },
  { title: "Photographer / Portfolio", theme: "Darkroom", heading: "Light, land and people" },
  { title: "Shop", theme: "Market", heading: "Handmade pots for happy plants" },
] as const;
