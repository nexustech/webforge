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
  return (
    <span style={{ opacity: 0.6, fontStyle: "italic" }}>{t(`site.binding.empty.${key}`)}</span>
  );
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
    engine.setSettings((key) => values[key], emptySettingHint);
  };
  show();
  return session.history.document.subscribe((site) => {
    if (site.settings !== shown) {
      shown = site.settings;
      show();
    }
  });
}
