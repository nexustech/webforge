// The editor's theme from its address (`?theme=light`, which main gives it: `editorPageAddress`),
// before the first paint, so the start-up screen in index.html and the window behind it are drawn
// in the person's theme while the editor's scripts load (#887). A classic script, not a module: it
// runs as index.html is read, before anything is drawn. main.tsx sets the theme again from the
// preferences, and keeps the address's in step when it changes (`applyTheme`).
{
  const theme = new URLSearchParams(window.location.search).get("theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
  }
}
