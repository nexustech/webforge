// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImageMeta, MediaId, SiteDoc } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../editor/starter-site.js";
import { SiteSettingsDialog } from "./SiteSettingsDialog.js";

afterEach(cleanup);

const photo: ImageMeta = {
  id: "photo" as MediaId,
  hash: "a".repeat(64),
  name: "shop",
  fileName: "shop.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  width: 800,
  height: 600,
  alt: "",
};

function setUp(site: SiteDoc = starterSite()) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <SiteSettingsDialog
      open
      site={site}
      onSave={onSave}
      onCancel={onCancel}
      imageUrl={(item) => `test://${item.name}`}
    />,
  );
  // No delay between keys: typing whole addresses one key at a time is slow in happy-dom.
  return { onSave, onCancel, user: userEvent.setup({ delay: null }) };
}

// Each test drives many inputs through user-event, which is slow in happy-dom under coverage.
const SLOW = 15_000;

describe("SiteSettingsDialog", () => {
  it(
    "saves what was changed across sections as one set of settings",
    async () => {
      const site = starterSite();
      site.media = { [photo.id]: photo };
      const { onSave, user } = setUp(site);

      const name = screen.getByLabelText("Site name");
      await user.clear(name);
      await user.type(name, "Rosa's Bakery");
      await user.click(screen.getByRole("radio", { name: "shop.jpg" }));
      await user.click(
        screen.getByLabelText("Show a back-to-top button once visitors scroll down"),
      );
      await user.click(screen.getByRole("tab", { name: "Contact & hours" }));
      await user.type(screen.getByLabelText("Phone number"), "+44 1234 567890");
      await user.click(screen.getByRole("button", { name: "Add opening hours" }));
      await user.click(screen.getByText("Tue"));
      await user.click(screen.getByRole("tab", { name: "Search engines" }));
      await user.click(screen.getByLabelText("Include a sitemap for search engines"));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave.mock.calls[0]?.[0]).toMatchObject({
        general: { name: "Rosa's Bakery", icon: "photo", backToTop: true },
        contact: {
          phone: "+44 1234 567890",
          openingHours: [{ days: ["tue"], opens: "09:00", closes: "17:00" }],
        },
        search: { includeSitemap: false },
      });
    },
    SLOW,
  );

  it(
    "says what to fix, shows its section and keeps the dialog open",
    async () => {
      const { onSave, user } = setUp();
      await user.click(screen.getByRole("tab", { name: "Contact & hours" }));
      await user.type(screen.getByLabelText("Email address"), "rosa at example");
      await user.click(screen.getByRole("tab", { name: "Analytics" }));

      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toBe(
        "Some values need fixing before they can be saved.",
      );
      // The first section with something to fix comes forward, the field pointing at its message.
      const email = screen.getByLabelText("Email address");
      expect(email.getAttribute("aria-invalid")).toBe("true");
      expect(
        document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent,
      ).toBe("Use an email address such as hello@example.com.");

      await user.clear(email);
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(onSave).toHaveBeenCalledTimes(1);
    },
    SLOW,
  );

  it(
    "adds and removes social profiles, and asks for the form service's value",
    async () => {
      const { onSave, user } = setUp();
      await user.click(screen.getByRole("tab", { name: "Social & sharing" }));
      await user.click(screen.getByRole("button", { name: "Add a profile" }));
      await user.click(screen.getByRole("button", { name: "Add a profile" }));
      await user.selectOptions(screen.getAllByLabelText("Network")[0] as HTMLElement, "instagram");
      await user.type(
        screen.getAllByLabelText("Profile address")[0] as HTMLElement,
        "https://instagram.com/rosas",
      );
      await user.click(
        screen.getAllByRole("button", { name: "Remove this profile" })[1] as HTMLElement,
      );
      await user.click(screen.getByRole("tab", { name: "Forms" }));
      await user.selectOptions(screen.getByLabelText("Form service"), "formsubmit");
      await user.type(screen.getByLabelText("Email address for messages"), "hi@example.com");

      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave.mock.calls[0]?.[0]).toMatchObject({
        social: { profiles: [{ network: "instagram", url: "https://instagram.com/rosas" }] },
        forms: { service: { kind: "formsubmit", email: "hi@example.com" } },
      });
    },
    SLOW,
  );

  it(
    "closes without saving on Cancel",
    async () => {
      const { onSave, onCancel, user } = setUp();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    },
    SLOW,
  );
});
