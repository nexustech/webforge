import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toast,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useMemo, useState } from "react";
import type { ProjectApi, RecentSite } from "../../shared/ipc/project.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { openSiteWith } from "./open-site.js";

/** How many sites File › Open Recent lists (PF-1). */
export const OPEN_RECENT_MAX = 5;

/** The Recent list as the window shows it too (the start screen), which lists it again on a change. */
export type ShownRecentSites = {
  /** `undefined` until it is first listed. */
  readonly sites: readonly RecentSite[] | undefined;
  /** Lists it again: a site was opened, taken off it, or it was cleared. */
  readonly changed: () => void;
};

/** Props of {@link OpenRecent}. */
export type OpenRecentProps = {
  /** Lists, opens and clears the recent sites; injectable for tests. Defaults to the preload API. */
  readonly project?: Pick<ProjectApi, "listRecent" | "openRecent" | "clearRecent"> | undefined;
  /** Starts the window over with the newly opened site; injectable for tests. */
  readonly restart?: (() => void) | undefined;
  /** The Recent list the window shows (the start screen's); listed here when left out. */
  readonly recent?: ShownRecentSites | undefined;
};

/** The calls File › Open Recent makes: `project`, or the preload API's. */
const projectApi = (project: OpenRecentProps["project"]) => project ?? window.webforge.project;

/** `text`, cut short with an ellipsis past `max` characters, as a menu item's label stays short. */
const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** A site's label in the submenu: its name, and its folder when another shown shares the name. */
function labelOf(site: RecentSite, shown: readonly RecentSite[]): string {
  const name = clip(site.name, 50);
  const shared = shown.some((other) => other.id !== site.id && other.name === site.name);
  if (!shared) return name;
  return t("command.openRecent.inFolder", {
    name,
    folder: clip(site.folder === "" ? site.fileName : site.folder, 25),
  });
}

/**
 * File › Open Recent's submenu (3.18, PF-1): the {@link OPEN_RECENT_MAX} most recently opened
 * sites, pinned or not, then Clear Recent, which asks first and keeps the pinned ones; with none,
 * a disabled No recent sites. Open Recent itself is registered by `SiteCommands`, after Open
 * Site…. A site opens as the start screen's Recent list opens it: main saves the open site first,
 * and a file that has gone is taken off the list, with the start screen's message as a toast. The
 * renderer knows a site by its id only, never its path.
 */
export function OpenRecent({ project, restart, recent }: OpenRecentProps) {
  const registry = useCommandRegistry();
  const [listed, setListed] = useState<readonly RecentSite[]>();
  const [confirming, setConfirming] = useState(false);
  const owned = recent === undefined;

  useEffect(() => {
    if (!owned) return;
    let current = true;
    // Read when called, as SiteCommands' are: a window without the preload API lists none.
    Promise.resolve()
      .then(() => projectApi(project).listRecent())
      .then(
        (sites) => {
          if (current) setListed(sites);
        },
        // A list that can't be read is an empty one, as on the start screen.
        () => {
          if (current) setListed([]);
        },
      );
    return () => {
      current = false;
    };
  }, [project, owned]);

  const sites = recent === undefined ? listed : recent.sites;
  const changed = recent?.changed;
  // Most recently opened first, pinned or not (the start screen lists the pinned first).
  const latest = useMemo(
    () =>
      [...(sites ?? [])]
        .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
        .slice(0, OPEN_RECENT_MAX),
    [sites],
  );
  const anyUnpinned = sites?.some((site) => !site.pinned) ?? false;

  useEffect(() => {
    const relist =
      changed ??
      (() => {
        projectApi(project)
          .listRecent()
          .then(setListed, () => setListed([]));
      });
    const submenu = COMMAND_IDS.openRecent;
    const removes =
      latest.length === 0
        ? [
            registry.register({
              id: COMMAND_IDS.noRecent,
              label: t("command.noRecent"),
              submenu,
              enabled: false,
              run: () => undefined,
            }),
          ]
        : [
            ...latest.map((site) =>
              registry.register({
                id: `${COMMAND_IDS.openRecent}.${site.id}`,
                label: labelOf(site, latest),
                submenu,
                run: () =>
                  openSiteWith(() => projectApi(project).openRecent(site.id), restart).then(
                    (message) => {
                      if (message === undefined) return;
                      toast.error(message);
                      // A site whose file has gone has left the list.
                      relist();
                    },
                  ),
              }),
            ),
            registry.register({
              id: COMMAND_IDS.clearRecent,
              label: t("command.clearRecent"),
              submenu,
              separated: true,
              // Only pinned sites left: nothing to clear.
              enabled: anyUnpinned,
              run: () => setConfirming(true),
            }),
          ];
    return () => {
      for (const remove of removes) remove();
    };
  }, [registry, project, restart, latest, anyUnpinned, changed]);

  const clear = async () => {
    setConfirming(false);
    try {
      await projectApi(project).clearRecent();
    } catch (error) {
      reportFailure("site.recent", error);
      toast.error(t("site.start.listFailed"));
    }
    if (changed === undefined) {
      setListed(
        await projectApi(project)
          .listRecent()
          .catch(() => listed ?? []),
      );
    } else {
      changed();
    }
  };

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("site.clearRecent.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("site.clearRecent.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("site.clearRecent.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void clear()}>
            {t("site.clearRecent.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
