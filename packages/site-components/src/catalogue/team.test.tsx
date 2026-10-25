import { t } from "@webforge/i18n";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { siteLibrary } from "./index.js";

const defaults = siteLibrary.components.Team?.defaults ?? {};

const photo: ResolvedImage = {
  src: "media/sam.jpg",
  sources: [],
  fallback: { type: "image/jpeg", srcset: "media/sam.jpg 400w" },
  width: 400,
  height: 400,
  alt: "Sam in the workshop",
};

/** What the export gives, with one photo in Media. */
const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  image: (id) => (id === "sam" ? photo : null),
};

/** The Team section with `props` over its defaults, as the export renders it. */
const render = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [{ type: "Team", props: { id: "team", ...defaults, ...props } }],
    siteLibrary,
    context,
  );

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of `html`, to query. */
function page(html: string) {
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = html;
  return happy.document;
}

/** Sam, with a photo, and `props` over that. */
const sam = (props: Record<string, unknown> = {}) => [
  {
    type: "TeamMember",
    props: { id: "sam", name: "Sam", role: "Joiner", photo: { mediaId: "sam" }, ...props },
  },
];

describe("the Team section", () => {
  it("renders with its starter text and three people, as the Add panel places it", () => {
    const doc = page(render());

    expect(doc.querySelector(".site-team h2")?.textContent).toBe(t("starter.teamTitle"));
    const people = doc.querySelectorAll(".site-team-member");
    expect(people).toHaveLength(3);
    for (const person of people) {
      expect(person.querySelector("h3")?.textContent).toBe(t("starter.teamMemberName"));
      expect(person.textContent).toContain(t("starter.teamMemberRole"));
      // No photo yet: no image.
      expect(person.querySelector("img")).toBeNull();
    }
  });

  it("lays its people out as cards, round photos or a list", () => {
    const cards = page(render({ variant: "cards", items: sam() }));
    const round = page(render({ variant: "round", items: sam() }));
    const list = page(render({ variant: "list", items: sam() }));

    expect(cards.querySelector(".site-team-member")?.className).toContain("bg-base-200");
    expect(cards.querySelector(".site-team-member img")?.className).toContain("aspect-square");
    expect(round.querySelector(".site-team-member")?.className).toContain("text-center");
    expect(round.querySelector(".site-team-member img")?.className).toContain("rounded-full");
    expect(round.querySelector(".grid")?.className).toContain("md:grid-cols-4");
    expect(list.querySelector(".site-team-member")?.className).toContain("items-start");
    expect(list.querySelector(".grid")?.className).toContain("md:grid-cols-2");
  });

  it("shows a photo with its alt text here, else Media's, and nothing for one gone", () => {
    const own = page(render({ items: sam({ photo: { mediaId: "sam", alt: "Sam smiling" } }) }));
    const media = page(render({ items: sam() }));
    const gone = page(render({ items: sam({ photo: { mediaId: "gone" } }) }));

    expect(own.querySelector(".site-team-member img")?.getAttribute("alt")).toBe("Sam smiling");
    expect(media.querySelector(".site-team-member img")?.getAttribute("alt")).toBe(
      "Sam in the workshop",
    );
    expect(gone.querySelector(".site-team-member img")).toBeNull();
  });

  it("grows every card under the pointer when the section says so, and none unless it does", () => {
    const plain = page(render({ items: sam() }));
    const growing = page(render({ hover: "grow" }));

    expect(plain.querySelector(".site-team-member")?.className).not.toContain("hover:");
    for (const person of growing.querySelectorAll(".site-team-member")) {
      expect(person.className).toContain("motion-safe:hover:scale-105");
    }
  });
});
