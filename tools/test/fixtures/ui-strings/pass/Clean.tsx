// Fixture for check-ui-strings: every user-facing string comes from t().
declare function t(key: string, params?: Record<string, string>): string;

export function Clean({ name }: { readonly name: string }) {
  return (
    <section aria-label={t("panel.title")} className="panel" data-testid="clean">
      <h2 title={t("panel.title")}>{t("panel.title")}</h2>
      <input placeholder={t("panel.search")} type="search" />
      <p>
        {name} · {t("panel.count", { count: "3" })} — / 100%
      </p>
    </section>
  );
}
