import { Button, cn, fieldControlClass } from "@webforge/editor-ui";
import { type HelpPage, searchHelp } from "@webforge/help";
import { t } from "@webforge/i18n";
import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import type { HelpTarget } from "../../shared/ipc/help.js";
import { HelpPageView } from "./HelpPageView.js";
import type { HelpLibrary } from "./help-library.js";

export type HelpWindowProps = {
  readonly library: HelpLibrary;
  /** Where it opens: the page and heading it was asked for, or the contents. */
  readonly start: HelpTarget;
  /** Opens a page on the web in the browser; false if it couldn't. */
  readonly openExternal: (url: string) => Promise<boolean>;
  /** Calls `show` whenever Help is opened again elsewhere. Returns a stop function. */
  readonly onShow: (show: (target: HelpTarget) => void) => () => void;
};

/** Where the window is, the places before it for Back, and a count of moves, to scroll on each. */
type Place = {
  readonly at: HelpTarget;
  readonly before: readonly HelpTarget[];
  readonly moves: number;
};

type Move = { readonly kind: "go"; readonly to: HelpTarget } | { readonly kind: "back" };

function move(place: Place, step: Move): Place {
  if (step.kind === "go") {
    return { at: step.to, before: [...place.before, place.at], moves: place.moves + 1 };
  }
  const previous = place.before.at(-1);
  return previous === undefined
    ? place
    : { at: previous, before: place.before.slice(0, -1), moves: place.moves + 1 };
}

/** A help page in a list: its title, and its summary under it. */
function PageEntry({
  page,
  current,
  onOpen,
}: {
  readonly page: HelpPage;
  readonly current: boolean;
  readonly onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current ? "page" : undefined}
        className={cn(
          "w-full rounded px-2 py-1 text-left hover:bg-accent focus-visible:bg-accent",
          current && "bg-accent font-medium",
        )}
        onClick={onOpen}
      >
        {page.title}
      </button>
    </li>
  );
}

/** Every page, by the contents' groups, each with its summary: where Help starts. */
function HelpHome({
  library,
  onOpen,
}: {
  readonly library: HelpLibrary;
  readonly onOpen: (page: string) => void;
}) {
  return (
    <article className="max-w-3xl">
      <h1 className="mb-3 text-2xl font-semibold">{t("help.home")}</h1>
      {library.contents.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="mt-6 mb-2 text-lg font-semibold">{group.title}</h2>
          <ul className="space-y-2">
            {group.pages.flatMap((id) => {
              const page = library.pages.get(id);
              return page === undefined
                ? []
                : [
                    <li key={id}>
                      <button
                        type="button"
                        className="font-medium underline underline-offset-2 hover:no-underline"
                        onClick={() => onOpen(id)}
                      >
                        {page.title}
                      </button>
                      <p className="text-sm text-muted-foreground">{page.summary}</p>
                    </li>,
                  ];
            })}
          </ul>
        </section>
      ))}
    </article>
  );
}

/**
 * The Help window (5.4b, HP-6, HP-10): the contents, or what a search finds, beside the page shown.
 * Links between pages stay here, with Back; a page on the web opens in the browser. Opened again
 * elsewhere, it moves to that page and heading.
 */
export function HelpWindow({ library, start, openExternal, onShow }: HelpWindowProps) {
  const [place, go] = useReducer(move, { at: start, before: [], moves: 0 });
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const main = useRef<HTMLElement>(null);

  const open = (to: HelpTarget) => {
    setQuery("");
    setNotice(undefined);
    go({ kind: "go", to });
  };

  useEffect(
    () =>
      onShow((to) => {
        setQuery("");
        go({ kind: "go", to });
      }),
    [onShow],
  );

  // Each place shows its heading, or the top of the page. A move takes the focus there too, so a
  // screen reader reads on from it; opening leaves it on the window's first control.
  // Each move is a new place, even to the same heading again.
  const { at } = place;
  const moved = place.moves > 0;
  useEffect(() => {
    const region = main.current;
    if (region === null) return;
    const heading = at.anchor === undefined ? null : document.getElementById(at.anchor);
    if (heading === null) region.scrollTop = 0;
    else heading.scrollIntoView({ block: "start" });
    if (moved) region.focus({ preventScroll: true });
  }, [at, moved]);

  const page = place.at.page === undefined ? undefined : library.pages.get(place.at.page);
  const results = query.trim() === "" ? undefined : searchHelp(library.ordered, query);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <nav
        aria-label={t("help.contents")}
        className="flex w-64 shrink-0 flex-col border-r border-border"
      >
        <div className="relative p-2">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            aria-label={t("help.search.label")}
            placeholder={t("help.search.placeholder")}
            className={`${fieldControlClass} pl-7`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 text-sm">
          {results === undefined ? (
            <>
              <button
                type="button"
                aria-current={place.at.page === undefined ? "page" : undefined}
                className={cn(
                  "mb-2 w-full rounded px-2 py-1 text-left hover:bg-accent",
                  place.at.page === undefined && "bg-accent font-medium",
                )}
                onClick={() => open({})}
              >
                {t("help.home")}
              </button>
              {library.contents.map((group) => (
                <section key={group.title} aria-label={group.title} className="mb-3">
                  <h2 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                    {group.title}
                  </h2>
                  <ul>
                    {group.pages.flatMap((id) => {
                      const entry = library.pages.get(id);
                      return entry === undefined
                        ? []
                        : [
                            <PageEntry
                              key={id}
                              page={entry}
                              current={place.at.page === id}
                              onOpen={() => open({ page: id })}
                            />,
                          ];
                    })}
                  </ul>
                </section>
              ))}
            </>
          ) : (
            <section aria-label={t("help.search.results")}>
              <h2 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                {t("help.search.results")}
              </h2>
              {results.length === 0 ? (
                <p role="status" className="px-2 py-1 text-muted-foreground">
                  {t("help.search.none")}
                </p>
              ) : (
                <ul>
                  {results.map((found) => (
                    <PageEntry
                      key={found.id}
                      page={found}
                      current={place.at.page === found.id}
                      onOpen={() => open({ page: found.id })}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </nav>
      <main ref={main} tabIndex={-1} className="flex-1 overflow-y-auto px-8 py-6 outline-none">
        {place.before.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2"
            aria-label={t("help.back.label")}
            onClick={() => go({ kind: "back" })}
          >
            <ArrowLeftIcon aria-hidden />
            {t("help.back")}
          </Button>
        )}
        {notice !== undefined && (
          <p role="status" className="mb-3 text-sm text-destructive">
            {notice}
          </p>
        )}
        {page === undefined ? (
          <>
            {place.at.page !== undefined && (
              <p role="status" className="mb-4 text-muted-foreground">
                {t("help.missing")}
              </p>
            )}
            <HelpHome library={library} onOpen={(id) => open({ page: id })} />
          </>
        ) : (
          <>
            {page.status === "partial" && (
              <p className="mb-3 rounded border border-border bg-muted px-3 py-2 text-sm">
                {t("help.partial")}
              </p>
            )}
            <HelpPageView
              page={page}
              onHelpLink={(to) => open(to)}
              onWebLink={(url) => {
                openExternal(url)
                  .then((opened) => setNotice(opened ? undefined : t("help.link.failed")))
                  .catch(() => setNotice(t("help.link.failed")));
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
