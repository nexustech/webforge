import { Button, Picker } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { type ImageMeta, isImageMeta, type SiteDoc, type ThemeTokens } from "@webforge/model";
import { type BrandProposal, brandFromImage, imageColours, oklchCss } from "@webforge/themes";
import { ImageIcon } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { mediaImageUrl } from "../../../shared/ipc/media.js";
import { readPixels } from "./image-pixels.js";

/** The colours a palette proposes, with the image they came from. */
type Proposed = { readonly image: ImageMeta; readonly proposal: BrandProposal };

/** What the palette from an image shows: nothing yet, a proposal, or why there's none. */
type Shown = Proposed | { readonly problem: string } | null;

/** The proposal's colours in order, by the glossary's names, each with its text. */
const PAIRS = [
  ["primary", "primary-content", "colour.role.brand"],
  ["secondary", "secondary-content", "colour.role.accent"],
  ["accent", "accent-content", "colour.role.secondAccent"],
] as const;

/** A Media image's thumbnail, which is all a palette needs. */
const thumbnailUrl = (item: ImageMeta) => mediaImageUrl(item, "thumbnail");

/** What choosing `image` shows: the colours it proposes for `theme`, or why there are none. */
async function proposalFor(
  image: ImageMeta,
  theme: ThemeTokens,
  imageUrl: (item: ImageMeta) => string,
  read: (url: string) => Promise<ArrayLike<number>>,
): Promise<Shown> {
  let pixels: ArrayLike<number>;
  try {
    pixels = await read(imageUrl(image));
  } catch {
    return { problem: t("theme.image.unreadable") };
  }
  const proposal = brandFromImage(imageColours(pixels), theme);
  return proposal === undefined ? { problem: t("theme.image.noColours") } : { image, proposal };
}

/** Props of {@link StudioImagePalette}. */
export type StudioImagePaletteProps = {
  readonly media: SiteDoc["media"];
  readonly theme: ThemeTokens;
  /** Uses the proposal (asked first, D7); resolves whether it was used. */
  readonly onUse: (proposal: BrandProposal, image: ImageMeta) => Promise<boolean>;
  /** An image's URL; Media's thumbnails by default. */
  readonly imageUrl?: (item: ImageMeta) => string;
  /** Reads an image's pixels; drawn on a canvas by default. */
  readonly read?: (url: string) => Promise<ArrayLike<number>>;
};

/**
 * A palette from an image (PG-2, F-DS-7), at the top of Theme Studio's colours: a logo or photo
 * chosen from Media proposes Brand, Accent and Second accent, each with its text, made readable as
 * the contrast guideline asks. Worked out on this computer from a small copy of the image; nothing
 * is sent anywhere. The proposal is shown first, and used as one step only when the person says so.
 */
export function StudioImagePalette({
  media,
  theme,
  onUse,
  imageUrl = thumbnailUrl,
  read = readPixels,
}: StudioImagePaletteProps) {
  const [picking, setPicking] = useState(false);
  const [shown, setShown] = useState<Shown>(null);
  const images = Object.values(media)
    .filter(isImageMeta)
    .map((each) => ({ id: each.id, label: each.fileName, keywords: [each.alt], image: each }));

  const propose = async (image: ImageMeta) => {
    setPicking(false);
    setShown(await proposalFor(image, theme, imageUrl, read));
  };

  return (
    <section
      aria-label={t("theme.image.title")}
      className="mb-3 flex flex-col gap-2 rounded-md border border-border p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-haspopup="dialog"
          onClick={() => setPicking(true)}
        >
          <ImageIcon aria-hidden className="size-3.5" />
          {t("theme.image.choose")}
        </Button>
        <p className="m-0 text-xs text-muted-foreground">{t("theme.image.hint")}</p>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {shown === null ? null : "problem" in shown ? (
          <p className="m-0 text-xs">{shown.problem}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={imageUrl(shown.image)}
              alt=""
              className="size-12 rounded-sm bg-input object-contain"
            />
            <ul
              aria-label={t("theme.image.proposal", { name: shown.image.fileName })}
              className="m-0 flex list-none gap-2 p-0"
            >
              {PAIRS.map(([role, text, name]) => (
                <li
                  key={role}
                  className="flex min-w-20 flex-col items-start gap-0.5 rounded-sm bg-(--swatch) px-2 py-1.5 text-xs text-(--swatch-text)"
                  style={
                    {
                      "--swatch": oklchCss(shown.proposal[role]),
                      "--swatch-text": oklchCss(shown.proposal[text]),
                    } as CSSProperties
                  }
                >
                  <span className="font-medium">{t(name)}</span>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex gap-1.5">
              <Button type="button" size="sm" variant="secondary" onClick={() => setShown(null)}>
                {t("theme.image.dismiss")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void onUse(shown.proposal, shown.image).then((used) => {
                    if (used) setShown(null);
                  });
                }}
              >
                {t("theme.image.use")}
              </Button>
            </div>
          </div>
        )}
      </div>
      <Picker
        open={picking}
        onOpenChange={setPicking}
        title={t("theme.image.pickerTitle")}
        description={t("theme.image.pickerDescription")}
        items={images}
        renderItem={(candidate) => (
          <img
            src={imageUrl(candidate.image)}
            alt=""
            className="aspect-square w-full rounded-sm bg-input object-cover"
          />
        )}
        onChoose={(candidate) => void propose(candidate.image)}
        emptyText={t("theme.image.noImages")}
      />
    </section>
  );
}
