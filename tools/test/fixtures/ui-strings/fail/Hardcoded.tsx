// Fixture for check-ui-strings: each marked line has one hard-coded user-facing string.
export function Hardcoded() {
  return (
    <section aria-label="Pages" className="panel">
      <h2>Pages</h2>
      <input placeholder={"Search pages"} type="search" />
      <button type="button" title={`Add page`}>
        {"Add"}
      </button>
      <img alt="Café “logo”" src="logo.png" />
    </section>
  );
}
