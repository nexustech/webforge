import { Button, TourCard } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import type { HelpApi } from "../../shared/ipc/help.js";
import { bundledHelpLibrary, type HelpLibrary, openHelpWith } from "../help/index.js";
import { NUMBERED_STEPS, TOUR_STEPS } from "./tour-steps.js";
import type { Tour } from "./tour-store.js";

/** Props of {@link TourCards}. */
export type TourCardsProps = {
  readonly tour: Tour;
  /** Opens a step's help page (*Learn more*). */
  readonly help: Pick<HelpApi, "open">;
  /** The help pages, for their titles; the bundled ones by default. */
  readonly library?: HelpLibrary;
};

/**
 * The tour's cards (OB-1…OB-3): the offer, then each step beside its control, then where help is.
 * None while the tour is closed.
 */
export function TourCards({ tour, help, library }: TourCardsProps) {
  const stage = useStore(tour.stage);
  if (stage === "closed") return null;

  if (stage === "offer") {
    return (
      <TourCard
        title={t("tour.offer.title")}
        focusKey="offer"
        onEscape={tour.skip}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={tour.skip}>
              {t("tour.offer.notNow")}
            </Button>
            <Button size="sm" onClick={tour.start}>
              {t("tour.offer.start")}
            </Button>
          </>
        }
      >
        <p className="m-0">{t("tour.offer.text")}</p>
        <p className="m-0 text-muted-foreground">{t("tour.offer.later")}</p>
      </TourCard>
    );
  }

  const step = TOUR_STEPS[stage];
  if (step === undefined) return null;
  const last = stage === TOUR_STEPS.length - 1;
  const page =
    step.helpPage === undefined
      ? undefined
      : (library ?? bundledHelpLibrary()).pages.get(step.helpPage);
  const { anchor } = step;
  return (
    <TourCard
      title={t(`tour.${step.id}.title`)}
      step={
        stage < NUMBERED_STEPS
          ? t("tour.step", { step: stage + 1, count: NUMBERED_STEPS })
          : undefined
      }
      anchor={anchor === undefined ? undefined : () => anchor(document)}
      focusKey={step.id}
      onEscape={tour.skip}
      actions={
        <>
          {last ? null : (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={tour.skip}>
              {t("tour.skip")}
            </Button>
          )}
          {stage === 0 ? null : (
            <Button variant="outline" size="sm" onClick={tour.back}>
              {t("tour.back")}
            </Button>
          )}
          <Button size="sm" onClick={tour.next}>
            {last ? t("tour.done") : t("tour.next")}
          </Button>
        </>
      }
    >
      <p className="m-0">{t(`tour.${step.id}.text`)}</p>
      {page === undefined ? null : (
        <Button
          variant="link"
          size="sm"
          className="h-auto self-start p-0"
          onClick={() => openHelpWith(help, { page: page.id })}
        >
          {t("tour.learnMore", { page: page.title })}
        </Button>
      )}
    </TourCard>
  );
}
