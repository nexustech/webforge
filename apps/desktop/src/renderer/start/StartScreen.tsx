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
import { FilePlusIcon, FolderOpenIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AppApi } from "../../shared/ipc/app.js";
import type { ProjectApi } from "../../shared/ipc/project.js";
import type { TemplatesApi } from "../../shared/ipc/templates.js";
import type { AppInfo, RecentSite } from "../../shared/ipc-contract.js";
import { reportFailure } from "../log.js";
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
import { AppMark } from "./AppMark.js";
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
    | "create"
    | "open"
    | "openZip"
    | "listRecent"
    | "openRecent"
    | "pinRecent"
    | "removeRecent"
    | "clearRecent"
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
 * start a site (the quick start, QS-4, or New Site's dialog, 2.14a), open one or try an example
 * (PG-3); on the right, the recent sites, searchable, pinned ones first, and a Help tab.
 */
export function StartScreen({ info, project, templates, app, restart, locale }: StartScreenProps) {
  const [registry] = useState(createCommandRegistry);
  // Unknown until main first answers: neither the welcome nor the list shows before then, so a
  // returning user never sees the first start's welcome flash past (#456 review).
  const [recent, setRecent] = useState<readonly RecentSite[]>();
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
      // A list that can't be read is an empty one: the welcome says how to start.
      () => {
        if (current) setRecent([]);
      },
    );
    return () => {
      current = false;
    };
  }, [api]);

  // Stable, so File › Open Recent's commands aren't registered again on every render.
  const relist = useCallback(() => {
    api.listRecent().then(setRecent, () => undefined);
  }, [api]);

  const run = async (request: () => ReturnType<ProjectApi["open"]>) => {
    setMessage(await openSiteWith(request, restart));
    // A site that turned out to be missing has left the list.
    setRecent(await api.listRecent().catch(() => recent ?? []));
  };

  /** Changes the Recent list with `change`, saying so if it can't, as Open's failures are. */
  const changeList = async (change: () => Promise<unknown>) => {
    try {
      await change();
      setMessage(undefined);
    } catch (error) {
      reportFailure("site.recent", error);
      setMessage(t("site.start.listFailed"));
    }
    // Main orders the list: pinned sites first.
    setRecent(await api.listRecent().catch(() => recent ?? []));
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
          {/* Not an editing surface: a reading size, larger than the editor's panels (SC-1). */}
          <main className="flex min-h-0 flex-1 text-base">
            <StartActions info={info} message={message} onOpen={() => void run(() => api.open())} />
            <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-10 py-10">
              <Tabs defaultValue="recent" className="flex w-full max-w-5xl flex-col gap-6">
                <TabsList aria-label={t("site.start.title")} className="h-10 self-start">
                  <TabsTrigger value="recent" className="px-4 text-sm">
                    {t("site.start.recent")}
                  </TabsTrigger>
                  <TabsTrigger value="help" className="px-4 text-sm">
                    {t("site.start.help")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="recent" className="bg-transparent">
                  {recent === undefined ? null : recent.length === 0 ? (
                    <Welcome info={info} onOpen={() => void run(() => api.open())} />
                  ) : (
                    <RecentSites
                      sites={recent}
                      locale={locale}
                      onOpen={(site) => void run(() => api.openRecent(site.id))}
                      onPin={(site, pinned) =>
                        void changeList(() => api.pinRecent(site.id, pinned))
                      }
                      onRemove={(site) => void changeList(() => api.removeRecent(site.id))}
                    />
                  )}
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
          // File › Open Recent lists what the Recent list shows, and Clear Recent updates it (3.18).
          recent={{ sites: recent, changed: relist }}
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

/** The start screen's actions: larger than the editor's buttons (SC-1). */
const ACTION = "h-10 justify-start px-4 text-base [&_svg:not([class*='size-'])]:size-5";

/**
 * The start screen's left column (LF-10, SC-2): Webforge's mark, name and version, then Start a
 * site (the quick start, QS-4), New Site, Open and, when the app ships an example, Try an Example;
 * and why something couldn't be done.
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
    <aside className="flex w-80 shrink-0 flex-col gap-3 border-r border-border bg-panel px-8 py-10">
      <div className="flex items-center gap-3 pb-6">
        <AppMark />
        <div className="flex flex-col">
          <h1 className="m-0 text-2xl font-semibold">{info.name}</h1>
          <p className="m-0 text-sm text-muted-foreground">
            {t("site.start.version", { version: info.version })}
          </p>
        </div>
      </div>
      <h2 className="m-0 text-base font-medium text-muted-foreground">{t("site.start.title")}</h2>
      <Button type="button" className={ACTION} onClick={() => registry.run(COMMAND_IDS.quickStart)}>
        <WandSparklesIcon />
        {t("site.start.quickStart")}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={ACTION}
        onClick={() => registry.run(COMMAND_IDS.newSite)}
      >
        <FilePlusIcon />
        {t("site.start.new")}
      </Button>
      <Button type="button" variant="outline" className={ACTION} onClick={onOpen}>
        <FolderOpenIcon className="text-warning" />
        {t("site.start.open")}
      </Button>
      {example === undefined ? null : (
        <Button
          type="button"
          variant="outline"
          className={ACTION}
          onClick={() => registry.run(example.id)}
        >
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

/**
 * The first start, with no recent sites yet (SC-3): a welcome, and the ways in, each saying what
 * it does, instead of an empty list.
 */
function Welcome({ info, onOpen }: { readonly info: AppInfo; readonly onOpen: () => void }) {
  const registry = useCommandRegistry();
  const example = useCommand(COMMAND_IDS.tryExample);
  const choices = [
    {
      id: "quickStart",
      label: t("site.start.quickStart"),
      description: t("site.start.quickStart.description"),
      icon: <WandSparklesIcon className="size-6 text-primary" />,
      run: () => registry.run(COMMAND_IDS.quickStart),
    },
    ...(example === undefined
      ? []
      : [
          {
            id: "example",
            label: t("site.start.tryExample"),
            description: t("site.start.tryExample.description"),
            icon: <SparklesIcon className="size-6 text-primary" />,
            run: () => registry.run(example.id),
          },
        ]),
    {
      id: "open",
      label: t("site.start.open"),
      description: t("site.start.open.description"),
      icon: <FolderOpenIcon className="size-6 text-warning" />,
      run: onOpen,
    },
  ];
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-3xl font-semibold">
          {t("site.start.welcome", { name: info.name })}
        </h2>
        <p className="m-0 text-lg text-muted-foreground">{t("site.start.welcomeText")}</p>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        {choices.map((choice) => (
          <li key={choice.id}>
            <button
              type="button"
              className="flex size-full flex-col gap-2 rounded-lg border border-border bg-panel p-5 text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => void choice.run()}
            >
              {choice.icon}
              <span className="text-base font-medium">{choice.label}</span>
              <span className="text-sm text-muted-foreground">{choice.description}</span>
            </button>
          </li>
        ))}
      </ul>
      {/* New Site, for people who know what they want (QS-4). */}
      <Button
        type="button"
        variant="link"
        className="self-start px-0 text-base"
        onClick={() => registry.run(COMMAND_IDS.newSite)}
      >
        {t("site.start.new")}
      </Button>
      <p className="m-0 text-sm text-muted-foreground">{t("site.start.noRecent")}</p>
    </div>
  );
}
