// Fixture for check-ui-strings: each line from 6 on has one hard-coded user-facing string.
declare function EmptyState(props: { readonly emptyText: string }): null;
declare function t(key: string): string;

export function Hardcoded({ busy, count }: { readonly busy: boolean; readonly count: number }) {
  return (
    <section aria-label="Pages" className="panel">
      <h2>Pages</h2>
      <input placeholder={"Search pages"} type="search" />
      <button type="button" title={`Add page`}>
        {"Add"}
      </button>
      <img alt="Café “logo”" src="logo.png" />
      <p>{busy ? "Saving" : t("saved")}</p>
      <p title={`${count} pages`}>{count}</p>
      <EmptyState emptyText="No pages yet" />
    </section>
  );
}
