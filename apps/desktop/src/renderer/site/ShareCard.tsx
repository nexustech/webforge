import { t } from "@webforge/i18n";
import { PreviewSection } from "./PreviewSection.js";
import type { PagePreview } from "./page-preview.js";

/**
 * The page as a link preview when it's shared (3.16, G22): its share picture (the site's when it
 * has none), the web address's host, and the Open Graph title and description the export writes.
 */
export function ShareCard({ preview }: { readonly preview: PagePreview }) {
  return (
    <PreviewSection
      label={t("pageSettings.preview.share")}
      {...(preview.host === undefined ? { hint: t("pageSettings.preview.noAddress") } : {})}
    >
      <div className="grid w-full max-w-[22rem] overflow-hidden rounded-md border border-border bg-card">
        {preview.image === undefined ? (
          <div className="flex aspect-[1.91/1] items-center justify-center bg-muted text-xs text-muted-foreground">
            {t("pageSettings.preview.noImage")}
          </div>
        ) : (
          <img src={preview.image} alt="" className="aspect-[1.91/1] w-full object-cover" />
        )}
        <div className="grid gap-0.5 p-3">
          {preview.host === undefined ? null : (
            <p className="m-0 truncate text-xs text-muted-foreground uppercase">{preview.host}</p>
          )}
          <p className="m-0 line-clamp-2 text-sm font-semibold text-card-foreground [overflow-wrap:anywhere]">
            {preview.title}
          </p>
          {preview.description === undefined ? null : (
            <p className="m-0 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {preview.description}
            </p>
          )}
        </div>
      </div>
    </PreviewSection>
  );
}
