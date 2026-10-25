import { Button, Toaster, TooltipProvider } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { FilePlusIcon, FolderOpenIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppApi } from "../../shared/ipc/app.js";
import type { ProjectApi } from "../../shared/ipc/project.js";
import type { TemplatesApi } from "../../shared/ipc/templates.js";
import type { AppInfo, RecentSite } from "../../shared/ipc-contract.js";
import { AboutDialog } from "../shell/AboutDialog.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry, installCommandShortcuts, isMac } from "../shell/commands.js";
import { ShortcutSheet } from "../shell/ShortcutSheet.js";
import { TitleBar } from "../shell/TitleBar.js";
import { openSiteWith } from "./open-site.js";
import { SiteCommands } from "./SiteCommands.js";

/** Props of {@link StartScreen}. */
export type StartScreenProps = {
  readonly info: AppInfo;
  /** The preload API's site calls; injectable for tests. */
  readonly project?: Pick<
    ProjectApi,
    "create" | "open" | "listRecent" | "openRecent" | "removeRecent"
  >;
  /** Lists the templates New Site offers; injectable for tests. */
  readonly templates?: Pick<TemplatesApi, "list">;
  /** Answers the main process's save requests; injectable for tests. */
  readonly app?: Pick<AppApi, "onFlushRequest">;
  /** Starts the window over with the newly opened site; injectable for tests. */
  readonly restart?: () => void;
  /** Formats times on the Recent list; injectable for tests. */
  readonly locale?: string;
};

/**
 * The window when no site is open (F-SITE-1, F-SITE-2): start a site (New Site's dialog: Blank or a
 * template, 2.14a), open one, or pick one of the recently opened sites, each with its thumbnail
 * and when it was last edited.
 */
export function StartScreen({ info, project, templates, app, restart, locale }: StartScreenProps) {
  const [registry] = useState(createCommandRegistry);
  const [recent, setRecent] = useState<readonly RecentSite[]>([]);
  const [message, setMessage] = useState<string>();
  // Read once: the effects below must not run again just because this component re-renders.
  const [api] = useState(() => project ?? window.webforge.project);

  useEffect(() => installCommandShortcuts(window, registry), [registry]);

  // Nothing to save here: answer at once, so closing the window never waits for a timeout.
  useEffect(() => (app ?? window.webforge.app).onFlushRequest(async () => undefined), [app]);

  useEffect(() => {
    let current = true;
    api.listRecent().then(
      (sites) => {
        if (current) setRecent(sites);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [api]);

  const run = async (request: () => ReturnType<ProjectApi["open"]>) => {
    setMessage(await openSiteWith(request, restart));
    // A site that turned out to be missing has left the list.
    setRecent(await api.listRecent().catch(() => recent));
  };

  const remove = async (id: string) => {
    await api.removeRecent(id);
    setRecent((sites) => sites.filter((site) => site.id !== id));
  };

  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <CommandRegistryProvider registry={registry}>
      <TooltipProvider>
        <div className="flex h-full flex-col bg-background text-foreground">
          <TitleBar
            siteName={t("app.name")}
            // On macOS the menus are the menu bar's (LF-13).
            menuBar={isMac() ? window.webforge.app : undefined}
          />
          <main className="flex min-h-0 flex-1 justify-center overflow-y-auto p-8">
            <div className="flex w-full max-w-3xl flex-col gap-8">
              <section aria-labelledby="start-new" className="flex flex-col gap-3">
                <h2 id="start-new" className="m-0 text-lg font-semibold">
                  {t("site.start.title")}
                </h2>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => registry.run(COMMAND_IDS.newSite)}>
                    <FilePlusIcon />
                    {t("site.start.new")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void run(() => api.open())}
                  >
                    <FolderOpenIcon className="text-warning" />
                    {t("site.start.open")}
                  </Button>
                </div>
                {message === undefined ? null : (
                  <p role="alert" className="m-0 text-sm text-destructive-text">
                    {message}
                  </p>
                )}
              </section>
              <section aria-labelledby="start-recent" className="flex flex-col gap-3">
                <h2 id="start-recent" className="m-0 text-lg font-semibold">
                  {t("site.start.recent")}
                </h2>
                {recent.length === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">{t("site.start.noRecent")}</p>
                ) : (
                  <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 p-0">
                    {recent.map((site) => (
                      <li key={site.id} className="relative">
                        <button
                          type="button"
                          className="flex w-full flex-col overflow-hidden rounded-md border border-border bg-panel text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                          disabled={site.missing}
                          onClick={() => void run(() => api.openRecent(site.id))}
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
                          <span className="flex flex-col gap-0.5 p-2">
                            <span className="truncate text-sm font-medium">{site.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {site.missing
                                ? t("site.start.missing")
                                : site.lastEdited === null
                                  ? t("site.start.opened", {
                                      when: when.format(new Date(site.lastOpened)),
                                    })
                                  : t("site.start.edited", {
                                      when: when.format(new Date(site.lastEdited)),
                                    })}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {site.fileName}
                            </span>
                          </span>
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute top-1 right-1"
                          aria-label={t("site.start.remove", { name: site.name })}
                          title={t("site.start.remove", { name: site.name })}
                          onClick={() => void remove(site.id)}
                        >
                          <XIcon />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </main>
        </div>
        <SiteCommands
          project={api}
          {...(templates === undefined ? {} : { templates })}
          {...(restart === undefined ? {} : { restart })}
        />
        <AboutDialog info={info} />
        <ShortcutSheet editor={false} />
        <Toaster theme="dark" />
      </TooltipProvider>
    </CommandRegistryProvider>
  );
}
