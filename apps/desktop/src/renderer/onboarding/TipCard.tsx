import { Button, TourCard } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import type { EditorSession } from "../editor/editor-session.js";
import { REGION_ATTRIBUTE } from "../shell/regions.js";
import { TIP_ANCHORS, type Tips } from "./tips.js";

/** Props of {@link TipCard}. */
export type TipCardProps = {
  readonly tips: Tips;
  /** What's selected, for the first selection's tip, which points at it. */
  readonly session: Pick<EditorSession, "ui">;
};

/**
 * The first-time tip shown, if any (OB-4): a card as the tour's are, beside its place or centred,
 * closed with *Got it* or Esc. It leaves the focus where it is, and is read out as it appears; F6
 * reaches it.
 */
export function TipCard({ tips, session }: TipCardProps) {
  const tip = useStore(tips.shown);
  if (tip === null) return null;
  const anchor = TIP_ANCHORS[tip];
  return (
    <TourCard
      // A part of the window F6 moves to (5.5), as the panels are.
      {...{ [REGION_ATTRIBUTE]: "" }}
      title={t(`tip.${tip}.title`)}
      step={t("tip.label")}
      anchor={
        anchor === undefined
          ? undefined
          : () => anchor(document, session.ui.getState().nodeId ?? null)
      }
      focusKey={tip}
      // Shown as the person works: it never takes the focus from what they're doing.
      takeFocus={false}
      onEscape={tips.dismiss}
      actions={
        <Button size="sm" onClick={tips.dismiss}>
          {t("tip.gotIt")}
        </Button>
      }
    >
      <p className="m-0">{t(`tip.${tip}.text`)}</p>
    </TourCard>
  );
}
