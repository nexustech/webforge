import { Button, cn, fieldControlClass } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { PinIcon, SearchIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import type { RecentSite } from "../../shared/ipc-contract.js";

/** Props of {@link RecentSites}. */
export type RecentSitesProps = {
  /** The list as main gives it: pinned sites first, then the rest, newest first. */
  readonly sites: readonly RecentSite[];
  /** Formats when each was opened or edited. */
  readonly locale?: string | undefined;
  readonly onOpen: (site: RecentSite) => void;
  readonly onPin: (site: RecentSite, pinned: boolean) => void;
  readonly onRemove: (site: RecentSite) => void;
};

/** Whether `site`'s name, file or folder contains every word of `query`, ignoring case. */
function matchesSearch(site: RecentSite, query: string): boolean {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = `${site.name} ${site.fileName} ${site.folder}`.toLocaleLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * The start screen's Recent sites (F-SITE-2, LF-10): a search over them, and a card each, with its
 * thumbnail, name, folder and file, and when it was last edited, and buttons to pin it to the top
 * or take it off the list. A card opens its site; one whose file is gone can't.
 */
export function RecentSites({ sites, locale, onOpen, onPin, onRemove }: RecentSitesProps) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const shown = sites.filter((site) => matchesSearch(site, query));
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={searchId}
          type="search"
          aria-label={t("site.start.search")}
          placeholder={t("site.start.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={cn(fieldControlClass, "h-10 pl-9 text-base")}
        />
      </div>
      {shown.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground" role="status">
          {t("site.start.noMatch", { query: query.trim() })}
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4 p-0">
          {shown.map((site) => (
            <li key={site.id} className="relative">
              <button
                type="button"
                className="flex w-full flex-col overflow-hidden rounded-md border border-border bg-panel text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                disabled={site.missing}
                onClick={() => onOpen(site)}
              >
                {site.thumbnail === null ? (
                  <span className="aspect-video w-full bg-muted" aria-hidden />
                ) : (
                  <img
                    src={site.thumbnail}
                    alt=""
                    className="aspect-video w-full object-cover object-top"
                  />
                )}
                <span className="flex flex-col gap-1 p-3">
                  <span className="truncate text-base font-medium">{site.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {site.folder === "" ? site.fileName : `${site.folder} › ${site.fileName}`}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {site.missing
                      ? t("site.start.missing")
                      : site.lastEdited === null
                        ? t("site.start.opened", { when: when.format(new Date(site.lastOpened)) })
                        : t("site.start.edited", { when: when.format(new Date(site.lastEdited)) })}
                  </span>
                </span>
              </button>
              <span className="absolute top-1 right-1 flex gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn("bg-panel/80", site.pinned && "text-primary")}
                  // A toggle (APG): its name stays "Pin …", and pressed says it's pinned; the
                  // tooltip says what a click does.
                  aria-pressed={site.pinned}
                  aria-label={t("site.start.pin", { name: site.name })}
                  title={t(site.pinned ? "site.start.unpin" : "site.start.pinTip", {
                    name: site.name,
                  })}
                  onClick={() => onPin(site, !site.pinned)}
                >
                  {/* Filled while pinned, so the pin is seen at a glance (LF-10). */}
                  <PinIcon className={site.pinned ? "fill-current" : undefined} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="bg-panel/80"
                  aria-label={t("site.start.remove", { name: site.name })}
                  title={t("site.start.remove", { name: site.name })}
                  onClick={() => onRemove(site)}
                >
                  <XIcon />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
