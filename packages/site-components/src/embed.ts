/**
 * What a video or map section shows from another site (F-CM-4, C8): the address of the player or
 * map loaded into the page once the visitor asks for it, and a link to the same thing on its own
 * site, which works without JavaScript and loads nothing into the page.
 */
export type Embed = {
  /** Where the content comes from, for its placeholder's wording. */
  readonly provider: EmbedProvider;
  /** The player's or map's address, loaded in an `<iframe>` once the visitor clicks. */
  readonly src: string;
  /** The same video or place on the provider's own site. */
  readonly link: string;
};

export type EmbedProvider = "youtube" | "vimeo" | "googleMaps" | "openStreetMap";

/**
 * The hosts an embed's player or map may come from. The `embed` behaviour loads nothing else, so
 * a changed file can't make a page load another site.
 */
export const EMBED_HOSTS: Readonly<Record<EmbedProvider, string>> = {
  youtube: "www.youtube-nocookie.com",
  vimeo: "player.vimeo.com",
  googleMaps: "www.google.com",
  openStreetMap: "www.openstreetmap.org",
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
/** An unlisted Vimeo video's private hash (`vimeo.com/123/abcdef1234`). */
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;

/** `address` as a web address, or `undefined` if it isn't one. A missing `https://` is added. */
function webAddress(address: string): URL | undefined {
  const trimmed = address.trim();
  if (trimmed === "") return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m)\./, "");
const pathParts = (url: URL) => url.pathname.split("/").filter((part) => part !== "");

/** The YouTube video id in `url`: `watch?v=`, `youtu.be/`, `shorts/`, `embed/` or `live/`. */
function youtubeId(url: URL): string | undefined {
  const host = hostOf(url);
  const [first, second] = pathParts(url);
  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = first;
  } else if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    id =
      first === "watch"
        ? url.searchParams.get("v")
        : first === "shorts" || first === "embed" || first === "live"
          ? second
          : undefined;
  }
  return typeof id === "string" && YOUTUBE_ID.test(id) ? id : undefined;
}

/**
 * The video a YouTube or Vimeo address shows, as YouTube's privacy-enhanced player
 * (`youtube-nocookie.com`) or Vimeo's with Do Not Track, or `null` for any other address.
 */
export function videoEmbed(address: string): Embed | null {
  const url = webAddress(address);
  if (url === undefined) return null;
  const youtube = youtubeId(url);
  if (youtube !== undefined) {
    return {
      provider: "youtube",
      src: `https://${EMBED_HOSTS.youtube}/embed/${youtube}`,
      link: `https://www.youtube.com/watch?v=${youtube}`,
    };
  }
  const host = hostOf(url);
  const parts = pathParts(url);
  // vimeo.com/<id>[/<hash>], vimeo.com/channels/<name>/<id>, player.vimeo.com/video/<id>?h=<hash>
  const at =
    host === "player.vimeo.com"
      ? parts[0] === "video"
        ? 1
        : -1
      : host === "vimeo.com"
        ? parts.findIndex((part) => VIMEO_ID.test(part))
        : -1;
  const id = at >= 0 ? parts[at] : undefined;
  if (id === undefined || !VIMEO_ID.test(id)) return null;
  const hash = url.searchParams.get("h") ?? parts[at + 1];
  const unlisted = hash !== undefined && VIMEO_HASH.test(hash) ? hash : undefined;
  return {
    provider: "vimeo",
    src: `https://${EMBED_HOSTS.vimeo}/video/${id}?dnt=1${unlisted === undefined ? "" : `&h=${unlisted}`}`,
    link: `https://vimeo.com/${id}${unlisted === undefined ? "" : `/${unlisted}`}`,
  };
}

/** A point on an OpenStreetMap link: `#map=<zoom>/<lat>/<lon>`, or `?mlat=…&mlon=…`. */
function openStreetMapPoint(url: URL): { lat: number; lon: number; zoom: number } | undefined {
  if (hostOf(url) !== "openstreetmap.org") return undefined;
  const fromHash = /(?:^#|&)map=(\d{1,2})\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(url.hash);
  const zoom = Number(fromHash?.[1] ?? 16);
  const lat = Number(fromHash?.[2] ?? url.searchParams.get("mlat"));
  const lon = Number(fromHash?.[3] ?? url.searchParams.get("mlon"));
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 85 &&
    Math.abs(lon) <= 180 &&
    zoom >= 1 &&
    zoom <= 19 &&
    (fromHash !== null || (url.searchParams.has("mlat") && url.searchParams.has("mlon")));
  return valid ? { lat, lon, zoom } : undefined;
}

/** Degrees rounded to six places (about 0.1 m), so a map's address stays short. */
const degrees = (value: number) => Number(value.toFixed(6));

/**
 * The map `address` shows: an OpenStreetMap link with a point (`#map=17/51.5/-0.12`) as
 * OpenStreetMap's map with a marker there, and anything else as Google Maps' search for it, which
 * needs no key. A multi-line address is one line, its lines separated by commas. `null` when
 * `address` is empty.
 */
export function mapEmbed(address: string): Embed | null {
  const url = /^https?:\/\//i.test(address.trim()) ? webAddress(address) : undefined;
  const point = url === undefined ? undefined : openStreetMapPoint(url);
  if (point !== undefined) {
    // A box about four map tiles wide around the point, the width of the frame at the link's zoom:
    // a tile is 360° of longitude over 2^zoom. The map fits itself to the box.
    const half = (360 / 2 ** point.zoom) * 2;
    const box = [
      point.lon - half,
      point.lat - half / 2,
      point.lon + half,
      point.lat + half / 2,
    ].map(degrees);
    const marker = `${degrees(point.lat)},${degrees(point.lon)}`;
    return {
      provider: "openStreetMap",
      src: `https://${EMBED_HOSTS.openStreetMap}/export/embed.html?bbox=${box.join("%2C")}&layer=mapnik&marker=${marker.replace(",", "%2C")}`,
      link: `https://www.openstreetmap.org/?mlat=${degrees(point.lat)}&mlon=${degrees(point.lon)}#map=${point.zoom}/${degrees(point.lat)}/${degrees(point.lon)}`,
    };
  }
  const query = address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(", ");
  if (query === "") return null;
  const encoded = encodeURIComponent(query);
  return {
    provider: "googleMaps",
    src: `https://${EMBED_HOSTS.googleMaps}/maps?q=${encoded}&output=embed`,
    link: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}
