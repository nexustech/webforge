import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { SiteCodePiece } from "@webforge/model";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { CodeQuestion } from "../editor/code-trust.js";

/** Settings' Custom Code parts, as the prompt lists them. */
const PART_KEYS = {
  head: "site.code.trust.part.head",
  bodyEnd: "site.code.trust.part.bodyEnd",
  js: "site.code.trust.part.js",
} as const;

/**
 * "This site contains code that will run for your visitors" (#649): each piece of the site's code
 * its owner hasn't written here or confirmed, with *Review*, *Leave it out* and *Keep the code*.
 * Closing it is a cancel. `elementPlace` names where a Custom Code element is, as Site Check does.
 */
export function CodeTrustDialog({
  state,
  elementPlace,
}: {
  readonly state: StoreApi<{ readonly question: CodeQuestion }>;
  readonly elementPlace: (piece: Extract<SiteCodePiece, { kind: "element" }>) => string;
}) {
  const question = useStore(state, (current) => current.question);
  const answer = question?.answer;
  const named = (piece: SiteCodePiece) =>
    piece.kind === "code"
      ? t(PART_KEYS[piece.part])
      : piece.kind === "element"
        ? elementPlace(piece)
        : t("site.code.trust.allowList");
  return (
    <AlertDialog
      open={question !== null}
      onOpenChange={(open) => {
        if (!open) answer?.("cancel");
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("site.code.trust.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("site.code.trust.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {(question?.pieces ?? []).map((piece) => (
            <li
              key={
                piece.kind === "element"
                  ? `${piece.on}/${piece.nodeId}`
                  : piece.kind === "code"
                    ? piece.part
                    : piece.kind
              }
            >
              {named(piece)}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => answer?.("review")}>
            {t("site.code.trust.review")}
          </Button>
          <Button variant="outline" onClick={() => answer?.("leave")}>
            {t("site.code.trust.leave")}
          </Button>
          <Button onClick={() => answer?.("keep")}>{t("site.code.trust.keep")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
