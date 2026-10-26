/** The font catalogue (2.2): its categories and pairings, as the Theme panel's font picker shows them (stream B). */
export const fonts = {
  // Fontsource's categories, for the picker's category list (UX-15).
  "fonts.category.sans-serif": "Sans serif",
  "fonts.category.serif": "Serif",
  "fonts.category.display": "Display",
  "fonts.category.handwriting": "Handwriting",
  "fonts.category.monospace": "Monospace",
  // The tested pairings of a heading font and a body font (F-DS-2), by their ids in the catalogue.
  "fonts.pairing.simple": "Simple",
  "fonts.pairing.classic": "Classic",
  "fonts.pairing.modern": "Modern",
  "fonts.pairing.friendly": "Friendly",
  "fonts.pairing.elegant": "Elegant",
  "fonts.pairing.editorial": "Editorial",
  "fonts.pairing.bold": "Bold",
  "fonts.pairing.warm": "Warm",
  "fonts.pairing.crisp": "Crisp",
  "fonts.pairing.bookish": "Bookish",
  "fonts.pairing.technical": "Technical",
  "fonts.pairing.playful": "Playful",
  "fonts.pairing.handmade": "Handmade",
  "fonts.pairing.strong": "Strong",
  "fonts.pairing.luxury": "Luxury",
  // A theme font's field and the font picker (2.3a, UX-15).
  "fonts.choose": "Choose a font…",
  "fonts.change": "{name}",
  "fonts.picker.title": "Choose a font",
  "fonts.picker.description": "Double-click a font, or press Enter, to use it.",
  "fonts.picker.none": "No font matches.",
  "fonts.picker.tile": "Aa",
  "fonts.picker.sampleLabel": "Sample text",
  "fonts.picker.sample": "The quick brown fox jumps over the lazy dog",
} as const;
