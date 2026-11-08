import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useRef, useState } from "react";
import type { AiApi, BriefOutcome } from "../../shared/ipc/ai.js";
import type { PrefsApi } from "../../shared/ipc/prefs.js";
import type { NewSiteRequest, ProjectApi, ProjectResult } from "../../shared/ipc/project.js";
import type { TemplateSummary, TemplatesApi } from "../../shared/ipc/templates.js";
import { reportFailure } from "../log.js";
import { offerTour } from "../onboarding/index.js";
import { useCommandRegistry } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { NewSiteDialog } from "./NewSiteDialog.js";
import { OpenRecent, type ShownRecentSites } from "./OpenRecent.js";
import { openSiteWith } from "./open-site.js";
import { QuickStartDialog } from "./QuickStartDialog.js";
import { answersFromBrief, type QuickStartAnswers } from "./quick-start.js";
import { templateName } from "./template-labels.js";

/** Props of {@link SiteCommands}. */
export type SiteCommandsProps = {
  /** Creates and opens sites; injectable for tests. Defaults to the preload API. */
  readonly project?: Pick<
    ProjectApi,
    "create" | "open" | "openZip" | "listRecent" | "openRecent" | "clearRecent"
  >;
  /** Lists the templates New Site offers; injectable for tests. Defaults to the preload API. */
  readonly templates?: Pick<TemplatesApi, "list">;
  /** Starts the window over with the newly opened site; injectable for tests. */
  readonly restart?: () => void;
  /** Offers Help → Try an Example (PG-3): on the start screen, which lists the templates for it. */
  readonly example?: boolean;
  /** The Recent list the window shows (the start screen's), for File › Open Recent (3.18). */
  readonly recent?: ShownRecentSites;
  /** AI apps' briefs (4.12a); injectable for tests. Defaults to the preload API. */
  readonly ai?: Pick<AiApi, "onBrief">;
  /** Whether a brief is refused now: in Content mode (§5.10). */
  readonly refuseBrief?: () => boolean;
  /** The person's preferences, where the quick start asks for the tour (OB-1); injectable for tests. */
  readonly prefs?: Pick<PrefsApi, "get" | "set">;
};

/** An AI app's brief, shown as the quick start filled in: its answers, and how to say what became of it. */
type Brief = {
  readonly answers: QuickStartAnswers;
  readonly answer: (outcome: BriefOutcome) => Promise<void>;
};

/** The templates main lists; none when it can't, so a Blank site can still be made. */
const listTemplates = (templates: Pick<TemplatesApi, "list"> | undefined) =>
  (templates ?? window.webforge.templates).list().catch((error: unknown) => {
    reportFailure("site.templates", error);
    return [];
  });

/**
 * File → New Site… (Ctrl/Cmd+N), Start a Site… (the quick start, QS-1), Open Site… (Ctrl/Cmd+O),
 * Open Recent (3.18, {@link OpenRecent}) and Open Site from ZIP… (4.7), the title bar's New and
 * Open buttons (F-SITE-1, F-SITE-2), and on the start screen
 * Help → Try an Example (PG-3). New Site and the quick start show their dialogs (2.14a, 3.11b) with
 * the templates main lists; then main shows the save dialog and saves the open site before
 * switching. A failure appears as a toast.
 */
export function SiteCommands({
  project,
  templates,
  restart,
  example: offer = false,
  recent,
  ai,
  refuseBrief,
  prefs,
}: SiteCommandsProps) {
  const registry = useCommandRegistry();
  // The dialog open, New Site or the quick start, with the templates it shows, and the AI app's
  // brief it shows, if any; `null` for none.
  const [open, setOpen] = useState<{
    readonly dialog: "newSite" | "quickStart";
    readonly templates: readonly TemplateSummary[];
    readonly brief?: Brief;
  } | null>(null);
  // What's open, as a brief arriving reads it.
  const shown = useRef(open);
  useEffect(() => {
    shown.current = open;
  }, [open]);

  useEffect(() => {
    const listed = () => listTemplates(templates);
    const removeNew = registry.register({
      id: COMMAND_IDS.newSite,
      label: t("command.newSite"),
      menu: "file",
      run: () => listed().then((list) => setOpen({ dialog: "newSite", templates: list })),
    });
    const removeQuick = registry.register({
      id: COMMAND_IDS.quickStart,
      label: t("command.quickStart"),
      menu: "file",
      run: () => listed().then((list) => setOpen({ dialog: "quickStart", templates: list })),
    });
    const removeOpen = registry.register({
      id: COMMAND_IDS.openSite,
      label: t("command.openSite"),
      menu: "file",
      run: () => openWith(restart, () => (project ?? window.webforge.project).open()),
    });
    // Opens its submenu of sites, which OpenRecent fills; it runs nothing itself.
    const removeRecent = registry.register({
      id: COMMAND_IDS.openRecent,
      label: t("command.openRecent"),
      menu: "file",
      run: () => undefined,
    });
    // A site saved as a ZIP (4.7), opened as a new site once main has asked where to save it.
    const removeOpenZip = registry.register({
      id: COMMAND_IDS.openSiteZip,
      label: t("command.openSiteZip"),
      menu: "file",
      run: () => openWith(restart, () => (project ?? window.webforge.project).openZip()),
    });
    return () => {
      removeNew();
      removeQuick();
      removeOpen();
      removeRecent();
      removeOpenZip();
    };
  }, [registry, project, templates, restart]);

  // Try an example (PG-3, 2.14b): the first template marked as one, if the app ships any.
  const [example, setExample] = useState<TemplateSummary>();
  useEffect(() => {
    if (!offer) return;
    let current = true;
    (templates ?? window.webforge.templates).list().then(
      (listed) => {
        if (current) setExample(listed.find((template) => template.example));
      },
      (error: unknown) => reportFailure("site.templates", error),
    );
    return () => {
      current = false;
    };
  }, [offer, templates]);
  useEffect(() => {
    if (example === undefined) return;
    // Pre-filled and named after the example, straight from the template: no New Site dialog.
    return registry.register({
      id: COMMAND_IDS.tryExample,
      label: t("command.tryExample"),
      menu: "help",
      run: () =>
        openWith(restart, () =>
          (project ?? window.webforge.project).create(exampleRequest(example)),
        ),
    });
  }, [registry, example, project, restart]);

  // AI apps' briefs (4.12a): the quick start, filled in and on its last step, for the person to
  // check and create, or not. Refused in Content mode, and while the person has a New Site or
  // quick start of their own open, which a brief never replaces.
  useEffect(() => {
    const source = ai ?? window.webforge?.ai;
    const stop = source?.onBrief?.((brief, answer) => {
      if (refuseBrief?.() === true) {
        void answer("refused");
        return;
      }
      if (shown.current !== null) {
        void answer("busy");
        return;
      }
      void listTemplates(templates).then((list) => {
        if (shown.current !== null) {
          void answer("busy");
          return;
        }
        const answers = answersFromBrief(brief, list, t("site.untitledName"));
        setOpen({ dialog: "quickStart", templates: list, brief: { answers, answer } });
      });
    });
    return () => {
      if (typeof stop === "function") stop();
    };
  }, [ai, refuseBrief, templates]);

  /** Says the brief shown, if any, came to nothing. */
  const decline = () => {
    void open?.brief?.answer("declined");
  };

  const create = (request: NewSiteRequest) => {
    const brief = open?.brief;
    const quickStart = open?.dialog === "quickStart";
    setOpen(null);
    // A site the quick start made opens with the tour offered (OB-1), asked for before the window
    // starts over with it.
    const made = async () => {
      const result = await (project ?? window.webforge.project).create(request);
      if (result.status === "opened" && quickStart) {
        await offerTour(prefs ?? window.webforge.prefs);
      }
      return result;
    };
    if (brief === undefined) {
      openWith(restart, made);
      return;
    }
    // The AI app hears it was made before the window starts over with the new site.
    let created = false;
    const startOver = restart ?? (() => window.location.reload());
    void openSiteWith(made, () => {
      created = true;
      void brief.answer("created").finally(startOver);
    }).then((message) => {
      if (message !== undefined) toast.error(message);
      if (!created) void brief.answer("declined");
    });
  };
  const listedTemplates = open?.templates ?? [];

  return (
    <>
      <NewSiteDialog
        open={open?.dialog === "newSite"}
        templates={listedTemplates}
        onCreate={create}
        onCancel={() => setOpen(null)}
      />
      <QuickStartDialog
        open={open?.dialog === "quickStart"}
        templates={listedTemplates}
        // A brief opens it filled in, on the step the person checks last.
        {...(open?.brief === undefined
          ? {}
          : { initialAnswers: open.brief.answers, initialStep: "details" as const })}
        onCreate={create}
        onTryExample={(template) => {
          // The example is the template's, not the brief's.
          decline();
          setOpen(null);
          openWith(restart, () =>
            (project ?? window.webforge.project).create(exampleRequest(template)),
          );
        }}
        // New Site, with the templates already listed: one click away (QS-4).
        onChooseTemplate={() => {
          decline();
          setOpen({ dialog: "newSite", templates: listedTemplates });
        }}
        onCancel={() => {
          decline();
          setOpen(null);
        }}
      />
      <OpenRecent project={project} restart={restart} recent={recent} />
    </>
  );
}

/** A template's finished example (PG-3): pre-filled and named after it, its sample business kept. */
const exampleRequest = (template: TemplateSummary): NewSiteRequest => ({
  name: templateName(template.id),
  theme: template.theme,
  template: template.id,
});

/** Runs a create or open request, showing why it failed as a toast. */
function openWith(restart: (() => void) | undefined, request: () => Promise<ProjectResult>) {
  void openSiteWith(request, restart).then((message) => {
    if (message !== undefined) toast.error(message);
  });
}
