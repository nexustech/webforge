import { Button, type FieldRendererProps, registerFieldRenderer } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { SiteDoc } from "@webforge/model";
import { linkValue } from "@webforge/site-components";
import { LinkIcon } from "lucide-react";
import { useState } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { sameValue } from "../editor/same-value.js";
import { useDocument } from "../editor/use-document.js";
import { LinkDialog } from "./LinkDialog.js";
import type { LinkFieldChange } from "./link-change.js";
import { describeLink, linkTargets, type PageTarget } from "./link-targets.js";

/** Props of {@link LinkField}, besides the renderer's own. */
type LinkFieldContext = {
  /** The pages and sections a link can go to. */
  readonly targets: readonly PageTarget[];
  /** The site's Media, for links to documents. */
  readonly media: SiteDoc["media"];
  /** The site as it is now, for the dialog, which reads it as it opens. */
  readonly currentSite: () => SiteDoc;
};

/**
 * A link field in the Edit panel (F-ED-18): where the link goes in a few words, a button that opens
 * the {@link LinkDialog}, and one that removes the link. It reports a {@link LinkFieldChange}.
 */
function LinkField({
  id,
  value,
  onChange,
  onCommit,
  targets,
  media,
  currentSite,
}: FieldRendererProps & LinkFieldContext) {
  const [open, setOpen] = useState(false);
  const link = linkValue(value);
  // A page path or address typed as text before link fields: shown as it is, until replaced.
  const text = typeof value === "string" ? value.trim() : "";
  const summary = link === undefined && text !== "" ? text : describeLink(link, targets, media);
  const report = (change: LinkFieldChange) => {
    onChange(change);
    onCommit();
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <LinkIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span id={id} className="truncate">
          {summary}
        </span>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          {link === undefined && text === "" ? t("link.add") : t("link.edit")}
        </Button>
        {(link !== undefined || text !== "") && (
          <Button size="sm" variant="ghost" onClick={() => report({ link: undefined })}>
            {t("link.remove")}
          </Button>
        )}
      </div>
      <LinkDialog
        open={open}
        link={link}
        site={currentSite()}
        targets={targets}
        onSave={(change) => {
          setOpen(false);
          report(change);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

/**
 * Makes the Edit panel draw link fields with {@link LinkField} for `session`. Returns the function
 * that puts the previous renderer back.
 */
export function registerLinkField({ session }: { readonly session: EditorSession }): () => void {
  function SessionLinkField(props: FieldRendererProps) {
    // What the field shows: the pages and sections it can name, and the documents (R9). Typing on
    // the canvas changes neither, so it doesn't redraw the field.
    const { targets, media } = useDocument(
      session,
      (site) => ({ targets: linkTargets(site, session.library), media: site.media }),
      (a, b) => a.media === b.media && sameValue(a.targets, b.targets),
    );
    return (
      <LinkField
        {...props}
        targets={targets}
        media={media}
        currentSite={() => session.history.document.getState()}
      />
    );
  }
  return registerFieldRenderer("link", SessionLinkField);
}
