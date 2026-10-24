import { describe, expect, it } from "vitest";
import { EMBED_SOURCES, mapEmbed, videoEmbed } from "./embed.js";

describe("videoEmbed (F-CM-4)", () => {
  it.each([
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "https://youtube.com/watch?v=aqz-KE-bpKQ&t=42s",
    "https://m.youtube.com/watch?v=aqz-KE-bpKQ",
    "https://youtu.be/aqz-KE-bpKQ?si=abc",
    "https://www.youtube.com/shorts/aqz-KE-bpKQ",
    "https://www.youtube.com/embed/aqz-KE-bpKQ",
    "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
    "https://www.youtube.com/live/aqz-KE-bpKQ",
    "youtube.com/watch?v=aqz-KE-bpKQ",
    "  https://youtu.be/aqz-KE-bpKQ  ",
  ])("plays %s in YouTube's privacy-enhanced player", (address) => {
    expect(videoEmbed(address)).toEqual({
      provider: "youtube",
      src: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
      link: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    });
  });

  it("plays a Vimeo video with Do Not Track, an unlisted one with its hash", () => {
    for (const address of [
      "https://vimeo.com/76979871",
      "https://vimeo.com/channels/staffpicks/76979871",
      "https://player.vimeo.com/video/76979871",
    ]) {
      expect(videoEmbed(address)).toEqual({
        provider: "vimeo",
        src: "https://player.vimeo.com/video/76979871?dnt=1",
        link: "https://vimeo.com/76979871",
      });
    }
    for (const address of [
      "https://vimeo.com/76979871/1a2b3c4d5e",
      "https://player.vimeo.com/video/76979871?h=1a2b3c4d5e",
    ]) {
      expect(videoEmbed(address)?.src).toBe(
        "https://player.vimeo.com/video/76979871?dnt=1&h=1a2b3c4d5e",
      );
    }
  });

  it.each([
    "",
    "   ",
    "not a link",
    "https://example.com/watch?v=aqz-KE-bpKQ",
    "https://www.youtube.com/watch?v=too-short",
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ%22onload%3D",
    "https://www.youtube.com/channel/UC123",
    "https://vimeo.com/about",
    "javascript:alert(1)",
    "ftp://youtu.be/aqz-KE-bpKQ",
  ])("shows no video for %j", (address) => {
    expect(videoEmbed(address)).toBeNull();
  });
});

describe("mapEmbed (F-CM-4)", () => {
  it("shows an address on Google Maps, its lines joined by commas", () => {
    expect(mapEmbed("1 High Street\nHightown\n\n HT1 2AB ")).toEqual({
      provider: "googleMaps",
      src: "https://www.google.com/maps?q=1%20High%20Street%2C%20Hightown%2C%20HT1%202AB&output=embed",
      link: "https://www.google.com/maps/search/?api=1&query=1%20High%20Street%2C%20Hightown%2C%20HT1%202AB",
    });
  });

  it("encodes what was typed, so it can't add to the map's address", () => {
    const src = mapEmbed('Rosa\'s & Co "Bakery" #1 ?x=<y>')?.src ?? "";
    expect(new URL(src).searchParams.get("q")).toBe('Rosa\'s & Co "Bakery" #1 ?x=<y>');
    expect(new URL(src).searchParams.get("output")).toBe("embed");
  });

  it("shows an OpenStreetMap link's point on OpenStreetMap, with a marker", () => {
    const embed = mapEmbed("https://www.openstreetmap.org/#map=17/51.50101/-0.12418");

    expect(embed?.provider).toBe("openStreetMap");
    const src = new URL(embed?.src ?? "");
    expect(src.origin + src.pathname).toBe("https://www.openstreetmap.org/export/embed.html");
    expect(src.searchParams.get("marker")).toBe("51.50101,-0.12418");
    const [west, south, east, north] = (src.searchParams.get("bbox") ?? "").split(",").map(Number);
    expect(west).toBeLessThan(-0.12418);
    expect(east).toBeGreaterThan(-0.12418);
    expect(south).toBeLessThan(51.50101);
    expect(north).toBeGreaterThan(51.50101);
    expect(embed?.link).toBe(
      "https://www.openstreetmap.org/?mlat=51.50101&mlon=-0.12418#map=17/51.50101/-0.12418",
    );
    expect(mapEmbed("https://www.openstreetmap.org/?mlat=51.5&mlon=-0.12")?.provider).toBe(
      "openStreetMap",
    );
  });

  it("searches Google Maps for an OpenStreetMap link without a point, or with one off the map", () => {
    for (const address of [
      "https://www.openstreetmap.org/search?query=Hightown",
      "https://www.openstreetmap.org/#map=17/95/-0.12",
      "https://www.openstreetmap.org/#map=30/51.5/-0.12",
    ]) {
      expect(mapEmbed(address)?.provider).toBe("googleMaps");
    }
  });

  it("shows no map for an empty address", () => {
    expect(mapEmbed("")).toBeNull();
    expect(mapEmbed(" \n ")).toBeNull();
  });

  it("only ever points to the embed sources", () => {
    for (const embed of [
      videoEmbed("https://youtu.be/aqz-KE-bpKQ"),
      videoEmbed("https://vimeo.com/76979871"),
      mapEmbed("Hightown"),
      mapEmbed("https://www.openstreetmap.org/#map=17/51.5/-0.12"),
    ]) {
      const src = embed?.src ?? "";
      expect(
        Object.values(EMBED_SOURCES).some((source) => src.startsWith(source)),
        src,
      ).toBe(true);
    }
  });
});
