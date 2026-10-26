// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_THEME, type ImageMeta, type MediaId, type SiteDoc } from "@webforge/model";
import { brandFromImage, imageColours, themePreset } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioImagePalette } from "./StudioImagePalette.js";

afterEach(cleanup);

const logo: ImageMeta = {
  id: "logo" as MediaId,
  hash: "logo".padEnd(64, "0"),
  name: "logo",
  fileName: "Logo.png",
  kind: "image",
  mimeType: "image/png",
  width: 400,
  height: 400,
  alt: "Rosa's Bakery",
};

/** A red and blue logo on a clear ground, as a canvas would read it. */
const LOGO_PIXELS = Uint8ClampedArray.from([
  ...Array.from({ length: 30 }, () => [220, 30, 40, 255]).flat(),
  ...Array.from({ length: 20 }, () => [20, 60, 200, 255]).flat(),
  ...Array.from({ length: 50 }, () => [0, 0, 0, 0]).flat(),
]);

/** The palette with Media holding `media`, its images read by `read`. */
function setUp(
  media: SiteDoc["media"] = { [logo.id]: logo },
  read: (url: string) => Promise<ArrayLike<number>> = () => Promise.resolve(LOGO_PIXELS),
) {
  const onUse = vi.fn(() => Promise.resolve(true));
  render(
    <StudioImagePalette
      media={media}
      theme={DEFAULT_THEME}
      onUse={onUse}
      imageUrl={(item) => `test://${item.hash}`}
      read={read}
    />,
  );
  return { onUse, user: userEvent.setup({ delay: null }) };
}

/** Chooses the logo in the picker. */
async function chooseLogo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Colours from an image…" }));
  await user.dblClick(
    within(screen.getByRole("dialog", { name: "Choose an image" })).getByRole("option", {
      name: /Logo\.png/,
    }),
  );
}

describe("a palette from an image (2.3b, PG-2)", () => {
  it("proposes Brand, Accent and Second accent from a Media image, used only when asked", async () => {
    const { onUse, user } = setUp();

    await chooseLogo(user);
    const proposal = await screen.findByRole("list", { name: "Colours from Logo.png" });
    expect(
      within(proposal)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Brand", "Accent", "Second accent"]);
    expect(onUse).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use These Colours" }));
    expect(onUse).toHaveBeenCalledWith(
      expect.objectContaining({
        primary: expect.any(Object),
        "accent-content": expect.any(Object),
      }),
      logo,
    );
    await vi.waitFor(() => expect(screen.queryByRole("list", { name: /Colours from/ })).toBeNull());
  });

  it("fits the proposal to the theme as it is when it's used, not when it was chosen (#462)", async () => {
    const onUse = vi.fn(() => Promise.resolve(true));
    const props = {
      media: { [logo.id]: logo },
      onUse,
      imageUrl: (item: ImageMeta) => `test://${item.hash}`,
      read: () => Promise.resolve(LOGO_PIXELS),
    };
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<StudioImagePalette {...props} theme={DEFAULT_THEME} />);
    await chooseLogo(user);
    await screen.findByRole("list", { name: "Colours from Logo.png" });

    // Another theme meanwhile: a dark one.
    const dark = themePreset("dark");
    if (dark === undefined) throw new Error("no dark preset");
    rerender(<StudioImagePalette {...props} theme={dark} />);
    await user.click(screen.getByRole("button", { name: "Use These Colours" }));

    expect(onUse).toHaveBeenCalledWith(brandFromImage(imageColours(LOGO_PIXELS), dark), logo);
  });

  it("puts a proposal away unused", async () => {
    const { onUse, user } = setUp();

    await chooseLogo(user);
    await user.click(await screen.findByRole("button", { name: "Not Now" }));

    expect(screen.queryByRole("list", { name: /Colours from/ })).toBeNull();
    expect(onUse).not.toHaveBeenCalled();
  });

  it("says why there's no proposal: an image all clear, or one that can't be read", async () => {
    const clear = setUp({ [logo.id]: logo }, () =>
      Promise.resolve(Uint8ClampedArray.from([0, 0, 0, 0])),
    );
    await chooseLogo(clear.user);
    expect(
      await screen.findByText("That image has no colours to suggest: it's all clear."),
    ).toBeTruthy();
    cleanup();

    const broken = setUp({ [logo.id]: logo }, () => Promise.reject(new Error("tainted")));
    await chooseLogo(broken.user);
    expect(await screen.findByText("That image couldn't be read. Try another.")).toBeTruthy();
  });

  it("asks for an image in Media when there is none", async () => {
    const { user } = setUp({});

    await user.click(screen.getByRole("button", { name: "Colours from an image…" }));

    expect(screen.getByText("Add your logo or a photo to Media first.")).toBeTruthy();
  });
});
