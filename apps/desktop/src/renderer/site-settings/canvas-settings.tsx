import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { type BindableSetting, type SiteDoc, settingValues } from "@webforge/model";

type Unsubscribe = () => void;

/**
 * What an element bound to an empty Site Settings value shows on the canvas (1.17): a faint hint
 * saying where to fill it in. Styled inline, since the canvas's site CSS has only the site's own
 * classes; the export shows nothing there.
 */
function emptySettingHint(key: BindableSetting) {
  return hint(t(`site.binding.empty.${key}`));
}

/** A faint hint on the canvas, saying what to fill in where. */
function hint(text: string) {
  return <span style={{ opacity: 0.6, fontStyle: "italic" }}>{text}</span>;
}

/**
 * Shows Site Settings values on the canvas in elements bound to them, and draws the page again
 * whenever Site Settings change, so a value typed once shows on every page at once.
 */
export function connectCanvasSettings(
  engine: Pick<CanvasEngine, "setSettings">,
  session: {
    readonly history: {
      readonly document: {
        getState(): SiteDoc;
        subscribe(listener: (site: SiteDoc) => void): Unsubscribe;
      };
    };
  },
): Unsubscribe {
  let shown = session.history.document.getState().settings;
  const show = () => {
    const values = settingValues(shown);
    engine.setSettings({
      setting: (key) => values[key],
      emptySetting: emptySettingHint,
      openingHours: shown.contact.openingHours,
      socialProfiles: shown.social.profiles,
      socialHint: () => hint(t("site.binding.socialHint")),
      language: shown.general.language,
      ...(shown.forms.service === undefined ? {} : { formService: shown.forms.service }),
      formHint: (reason) => hint(t(`site.binding.formHint.${reason}`)),
    });
  };
  show();
  return session.history.document.subscribe((site) => {
    if (site.settings !== shown) {
      shown = site.settings;
      show();
    }
  });
}
