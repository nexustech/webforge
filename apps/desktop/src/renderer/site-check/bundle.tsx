import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Finding } from "@webforge/site-check";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { BundleResult } from "../../shared/ipc/site.js";
import type { EditorSession } from "../editor/editor-session.js";

/** What Download and bundle reaches: the person's yes, the download, and a message. */
export type BundleActions = {
  /** Asks the person first: resolves `true` if they go ahead. */
  readonly confirm: (url: string) => Promise<boolean>;
  /** Downloads the file at `url` (and the files it names) into the open site's file. */
  readonly download: (url: string) => Promise<BundleResult>;
  /** Tells the person why it didn't work. */
  readonly notify: (message: string) => void;
};

/** Kinds of file Download and bundle can keep: not a frame, a whole page from another website. */
const KEEPABLE = new Set(["script", "style", "font", "image", "media"]);

/**
 * Whether Download and bundle can fix `finding` (3.9): a file loaded from an `https://` address, in
 * Custom Code or the site's HTML or CSS, which the export can point at the copy. Not one a script
 * names (a script's addresses stay as written), and not a frame.
 */
export function canBundle(finding: Finding): boolean {
  const { place, values } = finding;
  const url = values?.url;
  return (
    typeof url === "string" &&
    !/^http:\/\//i.test(url) &&
    KEEPABLE.has(String(values?.kind)) &&
    !(place.kind === "code" && place.part === "js")
  );
}

/** `url`'s host, for the history's label; the address itself when it has none. */
function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("//") ? `https:${url}` : url).host;
  } catch {
    return url;
  }
}

/**
 * Download and bundle (C8, 3.9): once the person says yes, downloads the file at `url` into the
 * open site's file, then keeps it in the site's code, one undo step, so the export loads its own
 * copy. Nothing is downloaded without the click and the yes. A file kept before for the same
 * address is replaced.
 */
export async function downloadAndBundle(
  session: Pick<EditorSession, "edit">,
  bundle: BundleActions,
  url: string,
): Promise<void> {
  if (!(await bundle.confirm(url))) return;
  const result = await bundle
    .download(url)
    .catch((): BundleResult => ({ status: "failed", reason: "unknown" }));
  if (result.status === "failed") {
    bundle.notify(t(`siteCheck.bundle.failed.${result.reason}`));
    return;
  }
  const addresses = new Set(result.files.map((file) => file.url));
  session.edit("props", t("siteCheck.history.bundled", { host: hostOf(url) }), (draft) => {
    const kept = (draft.code.bundled ?? []).filter((file) => !addresses.has(file.url));
    draft.code.bundled = [...kept, ...result.files];
  });
}

/** The question the dialog asks, while it's open. */
type BundleQuestion = { readonly url: string; readonly answer: (yes: boolean) => void } | null;

/** The window's Download and bundle question: asked by Site Check's Fix, shown by its dialog. */
export function createBundleConfirm(): {
  readonly state: StoreApi<{ readonly question: BundleQuestion }>;
  readonly confirm: (url: string) => Promise<boolean>;
} {
  const state = createStore<{ readonly question: BundleQuestion }>(() => ({ question: null }));
  return {
    state,
    confirm: (url) => {
      state.getState().question?.answer(false);
      return new Promise((resolve) => {
        state.setState({
          question: {
            url,
            answer: (yes) => {
              state.setState({ question: null });
              resolve(yes);
            },
          },
        });
      });
    },
  };
}

/**
 * Asks before Download and bundle downloads a file (3.9): what will happen, and that the file's
 * licence is the person's to check, as it will be shared with their site.
 */
export function BundleDialog({
  state,
}: {
  readonly state: StoreApi<{ readonly question: BundleQuestion }>;
}) {
  const question = useStore(state, (current) => current.question);
  return (
    <AlertDialog
      open={question !== null}
      onOpenChange={(open) => {
        if (!open) question?.answer(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("siteCheck.bundle.title")}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {t("siteCheck.bundle.description", { url: question?.url ?? "" })}
          </AlertDialogDescription>
          <AlertDialogDescription>{t("siteCheck.bundle.licence")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("siteCheck.bundle.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => question?.answer(true)}>
            {t("siteCheck.bundle.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
