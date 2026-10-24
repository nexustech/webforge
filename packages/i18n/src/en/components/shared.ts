/**
 * Site components: what several families share. Field names every kind of component uses, the
 * spacing and colour choices, and the starter page's text.
 */
export const shared = {
  "category.text": "Text",
  "field.text": "Text",
  "field.title": "Title",
  "field.padding": "Padding",
  "field.margin": "Margin",
  // A component's layout variants (2.5): "Image on the left", "Three columns".
  "field.variant": "Layout",
  "field.side.top": "Top",
  "field.side.right": "Right",
  "field.side.bottom": "Bottom",
  "field.side.left": "Left",
  "field.spacing.none": "None",
  "field.spacing.s": "S",
  "field.spacing.m": "M",
  "field.spacing.l": "L",
  "field.spacing.xl": "XL",
  "field.color": "Colour",
  "field.color.default": "Text colour",
  "field.color.primary": "Primary",
  "field.color.secondary": "Secondary",
  "field.color.accent": "Accent",
  // The theme's colour roles, by their glossary names (UX-25).
  "colour.role.brand": "Brand",
  "colour.role.accent": "Accent",
  "colour.role.secondAccent": "Second accent",
  "colour.role.surface": "Surface",
  "colour.role.text": "Text",
  "colour.custom": "Custom",
  "colour.customValue": "Custom colour {hex}, off the theme",
  "colour.customHex": "Custom colour",
  "colour.offTheme": "Off the theme: changing the theme leaves this colour as it is.",
  "colour.useTheme": "Use a theme colour",
  "colour.shade": "Shade",
  "colour.shadeStep": "Shade {step}",
  "colour.opacity": "Opacity",
  "colour.opacityStep": "{step}%",
  "field.color.lowContrast":
    "Hard to read on the page: contrast {ratio}:1, less than the {needed}:1 this text needs.",
  "field.buttonLabel": "Button text",
  "field.buttonLink": "Button link",
  "field.image": "Image",
  "starter.heading": "Welcome to our business",
  "starter.text": "Tell visitors what you do and why they will love it.",
  "starter.notFoundHeading": "Sorry, this page doesn't exist",
  "starter.notFoundText":
    "It may have moved or been renamed. Use the menu above to find what you're looking for.",
} as const;
