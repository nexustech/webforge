import { t } from "@webforge/i18n";
import { PreviewSection } from "./PreviewSection.js";
import type { PagePreview } from "./page-preview.js";

/**
 * The page as a search result on a phone (3.16, SEO-6): its address, title and description, cut
 * where a phone's result cuts them. Soft guidance: no counter and no limit, as Google documents
 * none; it says so in its hint. A page kept from search says so instead.
 */
export function SearchResultCard({ preview }: { readonly preview: PagePreview }) {
  if (preview.hidden !== undefined) {
    return (
      <PreviewSection label={t("pageSettings.preview.search")}>
        <p className="m-0 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          {t(`pageSettings.preview.hidden.${preview.hidden}`)}
        </p>
      </PreviewSection>
    );
  }
  return (
    <PreviewSection
      label={t("pageSettings.preview.search")}
      hint={
        preview.inherited
          ? `${t("pageSettings.preview.inherited")} ${t("pageSettings.preview.hint")}`
          : t("pageSettings.preview.hint")
      }
    >
      <div className="grid w-full max-w-[22rem] gap-0.5 rounded-md border border-border bg-card p-3">
        <p className="m-0 truncate text-xs text-muted-foreground">{preview.address}</p>
        <p className="m-0 line-clamp-2 text-base leading-snug text-primary [overflow-wrap:anywhere]">
          {preview.title}
        </p>
        {preview.description === undefined ? (
          <p className="m-0 text-sm text-muted-foreground italic">
            {t("pageSettings.preview.noDescription")}
          </p>
        ) : (
          <p className="m-0 line-clamp-3 text-sm text-card-foreground [overflow-wrap:anywhere]">
            {preview.description}
          </p>
        )}
      </div>
    </PreviewSection>
  );
}
