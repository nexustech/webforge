import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toaster,
  TooltipProvider,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { FilePlusIcon, FolderOpenIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppApi } from "../../shared/ipc/app.js";
import type { ProjectApi } from "../../shared/ipc/project.js";
import type { TemplatesApi } from "../../shared/ipc/templates.js";
import type { AppInfo, RecentSite } from "../../shared/ipc-contract.js";
import { AboutDialog } from "../shell/AboutDialog.js";
import {
  CommandRegistryProvider,
  useCommand,
  useCommandRegistry,
} from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry, installCommandShortcuts, isMac } from "../shell/commands.js";
import { ShortcutSheet } from "../shell/ShortcutSheet.js";
import { TitleBar } from "../shell/TitleBar.js";
import { openSiteWith } from "./open-site.js";
import { RecentSites } from "./RecentSites.js";
import { SiteCommands } from "./SiteCommands.js";
import { StartHelp } from "./StartHelp.js";

/** Props of {@link StartScreen}. */
export type StartScreenProps = {
  readonly info: AppInfo;
  /** The preload API's site calls; injectable for tests. */
  readonly project?: Pick<
    ProjectApi,
    "create" | "open" | "listRecent" | "openRecent" | "pinRecent" | "removeRecent"
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
 * The window when no site is open (F-SITE-1, F-SITE-2), as Bootstrap Studio's (LF-10): on the left,
 * start a site (New Site's dialog, 2.14a), open one or try an example (PG-3); on the right, the
 * recent sites, searchable, pinned ones first, and a Help tab.
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

  const remove = async (site: RecentSite) => {
    await api.removeRecent(site.id);
    setRecent((sites) => sites.filter((each) => each.id !== site.id));
  };

  const pin = async (site: RecentSite, pinned: boolean) => {
    await api.pinRecent(site.id, pinned);
    // Main orders the list: pinned sites first.
    setRecent(await api.listRecent().catch(() => recent));
  };

  return (
    <CommandRegistryProvider registry={registry}>
      <TooltipProvider>
        <div className="flex h-full flex-col bg-background text-foreground">
          <TitleBar
            siteName={t("app.name")}
            // On macOS the menus are the menu bar's (LF-13).
            menuBar={isMac() ? window.webforge.app : undefined}
          />
          <main className="flex min-h-0 flex-1">
            <StartActions info={info} message={message} onOpen={() => void run(() => api.open())} />
            <section className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
              <Tabs defaultValue="recent" className="flex w-full max-w-5xl flex-col gap-4">
                <TabsList aria-label={t("site.start.title")} className="self-start">
                  <TabsTrigger value="recent">{t("site.start.recent")}</TabsTrigger>
                  <TabsTrigger value="help">{t("site.start.help")}</TabsTrigger>
                </TabsList>
                <TabsContent value="recent" className="bg-transparent">
                  <RecentSites
                    sites={recent}
                    locale={locale}
                    onOpen={(site) => void run(() => api.openRecent(site.id))}
                    onPin={(site, pinned) => void pin(site, pinned)}
                    onRemove={(site) => void remove(site)}
                  />
                </TabsContent>
                <TabsContent value="help" className="bg-transparent">
                  <StartHelp />
                </TabsContent>
              </Tabs>
            </section>
          </main>
        </div>
        <SiteCommands
          example
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

/**
 * The start screen's left column: the app and its version, New Site, Open and, when the app ships
 * an example, Try an Example; and why a site couldn't be opened.
 */
function StartActions({
  info,
  message,
  onOpen,
}: {
  readonly info: AppInfo;
  readonly message: string | undefined;
  readonly onOpen: () => void;
}) {
  const registry = useCommandRegistry();
  const example = useCommand(COMMAND_IDS.tryExample);
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 border-r border-border bg-panel px-6 py-8">
      <div className="flex flex-col gap-0.5 pb-3">
        <h1 className="m-0 text-xl font-semibold">{info.name}</h1>
        <p className="m-0 text-xs text-muted-foreground">
          {t("site.start.version", { version: info.version })}
        </p>
      </div>
      <h2 className="m-0 text-sm font-medium text-muted-foreground">{t("site.start.title")}</h2>
      <Button type="button" onClick={() => registry.run(COMMAND_IDS.newSite)}>
        <FilePlusIcon />
        {t("site.start.new")}
      </Button>
      <Button type="button" variant="outline" onClick={onOpen}>
        <FolderOpenIcon className="text-warning" />
        {t("site.start.open")}
      </Button>
      {example === undefined ? null : (
        <Button type="button" variant="outline" onClick={() => registry.run(example.id)}>
          <SparklesIcon />
          {t("site.start.tryExample")}
        </Button>
      )}
      {message === undefined ? null : (
        <p role="alert" className="m-0 text-sm text-destructive-text">
          {message}
        </p>
      )}
    </aside>
  );
}
