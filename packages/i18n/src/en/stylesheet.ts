/** The Stylesheet panel (CT-8, 6.8, `apps/desktop/src/renderer/stylesheet/`). */
export const stylesheet = {
  "stylesheet.panelTitle": "Stylesheet",
  "stylesheet.command": "Stylesheet",
  "stylesheet.editor": "Stylesheet (custom.css)",
  "stylesheet.toolbar": "Stylesheet actions",
  "stylesheet.target": "Target This Element",
  "stylesheet.move": "Move This Look to CSS",
  "stylesheet.complete.anchor": "Section anchor",
  "stylesheet.history.edited": "Edited site CSS",
  "stylesheet.history.target": "Targeted {element} in the stylesheet",
  "stylesheet.history.move": "Moved {element}'s look to CSS",
  "stylesheet.target.none": "Select an element on the canvas first.",
  "stylesheet.move.nothing":
    "This element has no look of its own to move: its Style tab follows the theme.",
  "stylesheet.move.inside":
    "This element's look styles a part inside it, such as its title, so it stays in its Style tab.",
  "stylesheet.move.failed": "The look couldn't be moved. Try again.",
  "stylesheet.move.kept.one":
    "1 setting styles a part inside the element, so it stays in its Style tab.",
  "stylesheet.move.kept.other":
    "{count} settings style a part inside the element, so they stay in its Style tab.",
  "stylesheet.lint.invalid": "This isn't valid CSS.",
  "stylesheet.lint.variable": "The theme has no variable {name}.",
  "stylesheet.lint.external":
    "A file from another website: your site won't work offline. Site Check can keep a copy with your site.",
  "stylesheet.lint.unused": "Nothing on your site has this class or id.",
} as const;
