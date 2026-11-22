import { type SiteDocumentChange } from "@webforge/model";
import { z } from "zod";
/**
 * Which opening of a site a renderer was loaded for (R6): a new random id each time a site is
 * opened or created. The renderer sends it with every change it saves, so a save that arrives after
 * another site replaced the open one (a hand-off, 1.8) is refused, never written into that site.
 */
export declare const sessionIdSchema: z.ZodUUID;
/** The site (`.wforge` project) that is open in the main process. */
declare const projectSummarySchema: z.ZodObject<
  {
    sessionId: z.ZodUUID;
    name: z.ZodString;
    fileName: z.ZodString;
    formatVersion: z.ZodInt;
    syncService: z.ZodNullable<
      z.ZodEnum<{
        dropbox: "dropbox";
        "google-drive": "google-drive";
        icloud: "icloud";
        onedrive: "onedrive";
      }>
    >;
  },
  z.core.$strict
>;
/** The site (`.wforge` project) that is open in the main process. */
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
/**
 * Why a site could not be created or opened. Mirrors `ProjectFileErrorCode` of
 * `@webforge/storage`, plus `unknown` for anything else (e.g. no permission to write the folder).
 */
declare const projectFailureReasonSchema: z.ZodEnum<{
  corrupt: "corrupt";
  "newer-format": "newer-format";
  "not-a-project": "not-a-project";
  "not-found": "not-found";
  "too-large": "too-large";
  "unexpected-schema": "unexpected-schema";
  unknown: "unknown";
}>;
/** Why a site could not be created or opened. */
export type ProjectFailureReason = z.infer<typeof projectFailureReasonSchema>;
/** Outcome of asking the main process to create or open a site. */
export declare const projectResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"opened">;
        project: z.ZodObject<
          {
            sessionId: z.ZodUUID;
            name: z.ZodString;
            fileName: z.ZodString;
            formatVersion: z.ZodInt;
            syncService: z.ZodNullable<
              z.ZodEnum<{
                dropbox: "dropbox";
                "google-drive": "google-drive";
                icloud: "icloud";
                onedrive: "onedrive";
              }>
            >;
          },
          z.core.$strict
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"canceled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          corrupt: "corrupt";
          "newer-format": "newer-format";
          "not-a-project": "not-a-project";
          "not-found": "not-found";
          "too-large": "too-large";
          "unexpected-schema": "unexpected-schema";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** Outcome of asking the main process to create or open a site. */
export type ProjectResult = z.infer<typeof projectResultSchema>;
/** Outcome of saving a copy of the open site as a ZIP (4.7). */
declare const saveSiteZipResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"saved">;
        fileName: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"canceled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "no-site": "no-site";
          "own-file": "own-file";
          "too-large": "too-large";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** Outcome of saving a copy of the open site as a ZIP. */
export type SaveSiteZipResult = z.infer<typeof saveSiteZipResultSchema>;
/** Outcome of reading the open site's documents. */
declare const readSiteResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"ok">;
        site: z.ZodType<
          {
            formatVersion: 17;
            settings: {
              general: {
                name: string;
                description?: string | undefined;
                language: string;
                icon?: (string & z.$brand<"MediaId">) | undefined;
                backToTop?: boolean | undefined;
                businessType?:
                  | "beauty"
                  | "creative"
                  | "food"
                  | "personal"
                  | "services"
                  | "shop"
                  | "trades"
                  | undefined;
                businessKind?: string | undefined;
                labels?: Record<string, string> | undefined;
              };
              address: {
                url?: string | undefined;
              };
              social: {
                profiles: {
                  network:
                    | "custom"
                    | "facebook"
                    | "github"
                    | "instagram"
                    | "linkedin"
                    | "tiktok"
                    | "x"
                    | "youtube";
                  url: string;
                }[];
                shareImage?: (string & z.$brand<"MediaId">) | undefined;
                xHandle?: string | undefined;
              };
              contact: {
                businessName?: string | undefined;
                email?: string | undefined;
                phone?: string | undefined;
                address?: string | undefined;
                openingHours: {
                  days: ("fri" | "mon" | "sat" | "sun" | "thu" | "tue" | "wed")[];
                  opens: string;
                  closes: string;
                }[];
                openingHoursNote?: string | undefined;
                priceRange?: string | undefined;
                geo?:
                  | {
                      latitude: number;
                      longitude: number;
                    }
                  | undefined;
              };
              search: {
                allowIndexing: boolean;
                includeSitemap: boolean;
                readableByAi?: boolean | undefined;
                askNoAiTraining?: boolean | undefined;
                verification?:
                  | {
                      google?: string | undefined;
                      bing?: string | undefined;
                    }
                  | undefined;
                keptAddresses?:
                  | {
                      from: string;
                      page: string & z.$brand<"PageId">;
                    }[]
                  | undefined;
              };
              analytics: {
                measurementId?: string | undefined;
                consentBanner: boolean;
                consentMessage?: string | undefined;
              };
              forms: {
                service?:
                  | {
                      kind: "formspree";
                      formId: string;
                    }
                  | {
                      kind: "web3forms";
                      accessKey: string;
                    }
                  | {
                      kind: "formsubmit";
                      email: string;
                    }
                  | {
                      kind: "netlify";
                    }
                  | {
                      kind: "custom";
                      url: string;
                    }
                  | undefined;
              };
              allowedExternalUrls: string[];
            };
            theme: {
              preset: string;
              scheme: "dark" | "light";
              colors: Record<
                | "accent"
                | "accent-content"
                | "base-100"
                | "base-200"
                | "base-300"
                | "base-content"
                | "error"
                | "error-content"
                | "info"
                | "info-content"
                | "neutral"
                | "neutral-content"
                | "primary"
                | "primary-content"
                | "secondary"
                | "secondary-content"
                | "success"
                | "success-content"
                | "warning"
                | "warning-content",
                {
                  l: number;
                  c: number;
                  h: number;
                }
              >;
              inverse?:
                | Record<
                    | "accent"
                    | "accent-content"
                    | "base-100"
                    | "base-200"
                    | "base-300"
                    | "base-content"
                    | "error"
                    | "error-content"
                    | "info"
                    | "info-content"
                    | "neutral"
                    | "neutral-content"
                    | "primary"
                    | "primary-content"
                    | "secondary"
                    | "secondary-content"
                    | "success"
                    | "success-content"
                    | "warning"
                    | "warning-content",
                    {
                      l: number;
                      c: number;
                      h: number;
                    }
                  >
                | undefined;
              ownColors?:
                | {
                    id: string;
                    name: string;
                    color: {
                      l: number;
                      c: number;
                      h: number;
                    };
                  }[]
                | undefined;
              fonts: {
                heading: {
                  family: string;
                  fallback: "monospace" | "sans-serif" | "serif";
                };
                body: {
                  family: string;
                  fallback: "monospace" | "sans-serif" | "serif";
                };
                accent: {
                  family: string;
                  fallback: "monospace" | "sans-serif" | "serif";
                };
              };
              radius: {
                box: "full" | "l" | "m" | "none" | "s" | "xl";
                field: "full" | "l" | "m" | "none" | "s" | "xl";
                selector: "full" | "l" | "m" | "none" | "s" | "xl";
              };
              border: "thick" | "thin";
              effects: {
                depth: boolean;
                noise: boolean;
              };
              spacing: "compact" | "normal" | "roomy";
              typeScale: Record<
                "body" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "small",
                {
                  size: "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "base" | "lg" | "sm" | "xl" | "xs";
                  weight: number;
                  leading: "normal" | "relaxed" | "tight";
                }
              >;
              links: {
                underline: "always" | "hover";
              };
              buttons: {
                shape: "pill" | "rounded" | "square";
                size: "l" | "m" | "s";
                style: "filled" | "ghost" | "outline";
              };
              shadow: "none" | "soft" | "strong";
              headings: {
                case: "normal" | "small-caps" | "uppercase";
                tracking: "normal" | "tight" | "wide";
              };
              cards: {
                style: "flat" | "outlined" | "raised";
              };
              images: {
                corners: "rounded" | "soft" | "square";
              };
              looks?:
                | Record<
                    string,
                    Partial<
                      Record<
                        | "hover"
                        | "hoverEasing"
                        | "hoverSpeed"
                        | "lookAlign"
                        | "lookBackground"
                        | "lookBorder"
                        | "lookBorderBottom"
                        | "lookBorderColor"
                        | "lookBorderLeft"
                        | "lookBorderRight"
                        | "lookBorderStyle"
                        | "lookBorderTop"
                        | "lookCase"
                        | "lookColor"
                        | "lookCornerBottomLeft"
                        | "lookCornerBottomRight"
                        | "lookCornerTopLeft"
                        | "lookCornerTopRight"
                        | "lookCorners"
                        | "lookFont"
                        | "lookGradientDirection"
                        | "lookGradientFrom"
                        | "lookGradientOpacity"
                        | "lookGradientTo"
                        | "lookHoverColor"
                        | "lookItalic"
                        | "lookOpacity"
                        | "lookPadding"
                        | "lookShadow"
                        | "lookShadowInner"
                        | "lookSize"
                        | "lookSubtitleAlign"
                        | "lookSubtitleCase"
                        | "lookSubtitleColor"
                        | "lookSubtitleSize"
                        | "lookSubtitleWeight"
                        | "lookTitleColor"
                        | "lookUnderline"
                        | "lookWeight"
                        | "overlay"
                        | "overlayColor",
                        | string
                        | boolean
                        | {
                            $responsive: {
                              desktop: string | boolean;
                              tablet?: string | boolean | undefined;
                              mobile?: string | boolean | undefined;
                            };
                          }
                      >
                    >
                  >
                | undefined;
              sections: {
                rhythm: "alternating" | "plain";
              };
              own?:
                | {
                    id: string & z.$brand<"ThemeId">;
                    name: string;
                  }
                | undefined;
            };
            layout: import("@webforge/model").LayoutDoc;
            pages: Record<
              string & z.$brand<"PageId">,
              {
                id: string & z.$brand<"PageId">;
                kind: "not-found" | "page";
                slug: string;
                folder?: string | undefined;
                title: string;
                navLabel?: string | undefined;
                settings: {
                  description?: string | undefined;
                  shareImage?: (string & z.$brand<"MediaId">) | undefined;
                  hideHeader: boolean;
                  hideFooter: boolean;
                  hideFromNavigation: boolean;
                  hideBackToTop?: boolean | undefined;
                  hideFromSearch?: boolean | undefined;
                  privacy?: boolean | undefined;
                  draft?: boolean | undefined;
                };
                doc: import("@webforge/model").PageDoc;
                updated?: string | undefined;
                collection?: (string & z.$brand<"CollectionId">) | undefined;
                entry?: Record<string, string> | undefined;
              }
            >;
            pageOrder: (string & z.$brand<"PageId">)[];
            homePageId: string & z.$brand<"PageId">;
            media: Record<
              string & z.$brand<"MediaId">,
              | {
                  id: string & z.$brand<"MediaId">;
                  hash: string;
                  name: string;
                  fileName: string;
                  kind: "image";
                  mimeType: "image/jpeg" | "image/png";
                  width: number;
                  height: number;
                  alt: string;
                  focal?:
                    | {
                        x: number;
                        y: number;
                      }
                    | undefined;
                  crop?:
                    | {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                      }
                    | undefined;
                }
              | {
                  id: string & z.$brand<"MediaId">;
                  hash: string;
                  name: string;
                  fileName: string;
                  kind: "file";
                  mimeType:
                    | "application/msword"
                    | "application/pdf"
                    | "application/vnd.ms-excel"
                    | "application/vnd.ms-powerpoint"
                    | "application/vnd.oasis.opendocument.presentation"
                    | "application/vnd.oasis.opendocument.spreadsheet"
                    | "application/vnd.oasis.opendocument.text"
                    | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    | "text/csv"
                    | "text/plain";
                  size?: number | undefined;
                }
            >;
            code: import("@webforge/model").SiteCode;
            menu: {
              follows: "custom" | "pages";
              items: (
                | {
                    id: string & z.$brand<"MenuItemId">;
                    hidden: boolean;
                    kind: "page";
                    pageId: string & z.$brand<"PageId">;
                    label?: string | undefined;
                  }
                | {
                    id: string & z.$brand<"MenuItemId">;
                    hidden: boolean;
                    kind: "link";
                    link:
                      | {
                          kind: "page";
                          pageId: string & z.$brand<"PageId">;
                          anchor?: string | undefined;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "email";
                          address: string;
                          subject?: string | undefined;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "phone";
                          number: string;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "url";
                          href: string;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "file";
                          mediaId: string & z.$brand<"MediaId">;
                          newTab?: boolean | undefined;
                          download?: boolean | undefined;
                        }
                      | {
                          kind: "list";
                          collectionId: string & z.$brand<"CollectionId">;
                          newTab?: boolean | undefined;
                        };
                    label: string;
                  }
                | {
                    id: string & z.$brand<"MenuItemId">;
                    hidden: boolean;
                    kind: "section";
                    link: {
                      kind: "page";
                      pageId: string & z.$brand<"PageId">;
                      newTab?: boolean | undefined;
                      anchor: string;
                    };
                    label: string;
                  }
                | {
                    id: string & z.$brand<"MenuItemId">;
                    hidden: boolean;
                    kind: "button";
                    link:
                      | {
                          kind: "page";
                          pageId: string & z.$brand<"PageId">;
                          anchor?: string | undefined;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "email";
                          address: string;
                          subject?: string | undefined;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "phone";
                          number: string;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "url";
                          href: string;
                          newTab?: boolean | undefined;
                        }
                      | {
                          kind: "file";
                          mediaId: string & z.$brand<"MediaId">;
                          newTab?: boolean | undefined;
                          download?: boolean | undefined;
                        }
                      | {
                          kind: "list";
                          collectionId: string & z.$brand<"CollectionId">;
                          newTab?: boolean | undefined;
                        };
                    label: string;
                  }
                | {
                    id: string & z.$brand<"MenuItemId">;
                    hidden: boolean;
                    kind: "group";
                    label: string;
                    children: (
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "page";
                          pageId: string & z.$brand<"PageId">;
                          label?: string | undefined;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "link";
                          link:
                            | {
                                kind: "page";
                                pageId: string & z.$brand<"PageId">;
                                anchor?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "email";
                                address: string;
                                subject?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "phone";
                                number: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "url";
                                href: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "file";
                                mediaId: string & z.$brand<"MediaId">;
                                newTab?: boolean | undefined;
                                download?: boolean | undefined;
                              }
                            | {
                                kind: "list";
                                collectionId: string & z.$brand<"CollectionId">;
                                newTab?: boolean | undefined;
                              };
                          label: string;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "section";
                          link: {
                            kind: "page";
                            pageId: string & z.$brand<"PageId">;
                            newTab?: boolean | undefined;
                            anchor: string;
                          };
                          label: string;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "button";
                          link:
                            | {
                                kind: "page";
                                pageId: string & z.$brand<"PageId">;
                                anchor?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "email";
                                address: string;
                                subject?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "phone";
                                number: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "url";
                                href: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "file";
                                mediaId: string & z.$brand<"MediaId">;
                                newTab?: boolean | undefined;
                                download?: boolean | undefined;
                              }
                            | {
                                kind: "list";
                                collectionId: string & z.$brand<"CollectionId">;
                                newTab?: boolean | undefined;
                              };
                          label: string;
                        }
                    )[];
                  }
              )[];
            };
            sharedSections: Record<
              import("@webforge/model").SharedSectionId,
              import("@webforge/model").SharedSection
            >;
            collections: Record<
              string & z.$brand<"CollectionId">,
              {
                id: string & z.$brand<"CollectionId">;
                preset: "blog";
                name: string;
                folder: string;
                formerFolders?: string[] | undefined;
                fields: {
                  name: string;
                  label: string;
                  kind: "date" | "image" | "tags" | "text";
                }[];
                design: {
                  before: import("@webforge/model").NodeDoc[];
                  after: import("@webforge/model").NodeDoc[];
                };
              }
            >;
          },
          unknown,
          z.core.$ZodTypeInternals<
            {
              formatVersion: 17;
              settings: {
                general: {
                  name: string;
                  description?: string | undefined;
                  language: string;
                  icon?: (string & z.$brand<"MediaId">) | undefined;
                  backToTop?: boolean | undefined;
                  businessType?:
                    | "beauty"
                    | "creative"
                    | "food"
                    | "personal"
                    | "services"
                    | "shop"
                    | "trades"
                    | undefined;
                  businessKind?: string | undefined;
                  labels?: Record<string, string> | undefined;
                };
                address: {
                  url?: string | undefined;
                };
                social: {
                  profiles: {
                    network:
                      | "custom"
                      | "facebook"
                      | "github"
                      | "instagram"
                      | "linkedin"
                      | "tiktok"
                      | "x"
                      | "youtube";
                    url: string;
                  }[];
                  shareImage?: (string & z.$brand<"MediaId">) | undefined;
                  xHandle?: string | undefined;
                };
                contact: {
                  businessName?: string | undefined;
                  email?: string | undefined;
                  phone?: string | undefined;
                  address?: string | undefined;
                  openingHours: {
                    days: ("fri" | "mon" | "sat" | "sun" | "thu" | "tue" | "wed")[];
                    opens: string;
                    closes: string;
                  }[];
                  openingHoursNote?: string | undefined;
                  priceRange?: string | undefined;
                  geo?:
                    | {
                        latitude: number;
                        longitude: number;
                      }
                    | undefined;
                };
                search: {
                  allowIndexing: boolean;
                  includeSitemap: boolean;
                  readableByAi?: boolean | undefined;
                  askNoAiTraining?: boolean | undefined;
                  verification?:
                    | {
                        google?: string | undefined;
                        bing?: string | undefined;
                      }
                    | undefined;
                  keptAddresses?:
                    | {
                        from: string;
                        page: string & z.$brand<"PageId">;
                      }[]
                    | undefined;
                };
                analytics: {
                  measurementId?: string | undefined;
                  consentBanner: boolean;
                  consentMessage?: string | undefined;
                };
                forms: {
                  service?:
                    | {
                        kind: "formspree";
                        formId: string;
                      }
                    | {
                        kind: "web3forms";
                        accessKey: string;
                      }
                    | {
                        kind: "formsubmit";
                        email: string;
                      }
                    | {
                        kind: "netlify";
                      }
                    | {
                        kind: "custom";
                        url: string;
                      }
                    | undefined;
                };
                allowedExternalUrls: string[];
              };
              theme: {
                preset: string;
                scheme: "dark" | "light";
                colors: Record<
                  | "accent"
                  | "accent-content"
                  | "base-100"
                  | "base-200"
                  | "base-300"
                  | "base-content"
                  | "error"
                  | "error-content"
                  | "info"
                  | "info-content"
                  | "neutral"
                  | "neutral-content"
                  | "primary"
                  | "primary-content"
                  | "secondary"
                  | "secondary-content"
                  | "success"
                  | "success-content"
                  | "warning"
                  | "warning-content",
                  {
                    l: number;
                    c: number;
                    h: number;
                  }
                >;
                inverse?:
                  | Record<
                      | "accent"
                      | "accent-content"
                      | "base-100"
                      | "base-200"
                      | "base-300"
                      | "base-content"
                      | "error"
                      | "error-content"
                      | "info"
                      | "info-content"
                      | "neutral"
                      | "neutral-content"
                      | "primary"
                      | "primary-content"
                      | "secondary"
                      | "secondary-content"
                      | "success"
                      | "success-content"
                      | "warning"
                      | "warning-content",
                      {
                        l: number;
                        c: number;
                        h: number;
                      }
                    >
                  | undefined;
                ownColors?:
                  | {
                      id: string;
                      name: string;
                      color: {
                        l: number;
                        c: number;
                        h: number;
                      };
                    }[]
                  | undefined;
                fonts: {
                  heading: {
                    family: string;
                    fallback: "monospace" | "sans-serif" | "serif";
                  };
                  body: {
                    family: string;
                    fallback: "monospace" | "sans-serif" | "serif";
                  };
                  accent: {
                    family: string;
                    fallback: "monospace" | "sans-serif" | "serif";
                  };
                };
                radius: {
                  box: "full" | "l" | "m" | "none" | "s" | "xl";
                  field: "full" | "l" | "m" | "none" | "s" | "xl";
                  selector: "full" | "l" | "m" | "none" | "s" | "xl";
                };
                border: "thick" | "thin";
                effects: {
                  depth: boolean;
                  noise: boolean;
                };
                spacing: "compact" | "normal" | "roomy";
                typeScale: Record<
                  "body" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "small",
                  {
                    size:
                      | "2xl"
                      | "3xl"
                      | "4xl"
                      | "5xl"
                      | "6xl"
                      | "base"
                      | "lg"
                      | "sm"
                      | "xl"
                      | "xs";
                    weight: number;
                    leading: "normal" | "relaxed" | "tight";
                  }
                >;
                links: {
                  underline: "always" | "hover";
                };
                buttons: {
                  shape: "pill" | "rounded" | "square";
                  size: "l" | "m" | "s";
                  style: "filled" | "ghost" | "outline";
                };
                shadow: "none" | "soft" | "strong";
                headings: {
                  case: "normal" | "small-caps" | "uppercase";
                  tracking: "normal" | "tight" | "wide";
                };
                cards: {
                  style: "flat" | "outlined" | "raised";
                };
                images: {
                  corners: "rounded" | "soft" | "square";
                };
                looks?:
                  | Record<
                      string,
                      Partial<
                        Record<
                          | "hover"
                          | "hoverEasing"
                          | "hoverSpeed"
                          | "lookAlign"
                          | "lookBackground"
                          | "lookBorder"
                          | "lookBorderBottom"
                          | "lookBorderColor"
                          | "lookBorderLeft"
                          | "lookBorderRight"
                          | "lookBorderStyle"
                          | "lookBorderTop"
                          | "lookCase"
                          | "lookColor"
                          | "lookCornerBottomLeft"
                          | "lookCornerBottomRight"
                          | "lookCornerTopLeft"
                          | "lookCornerTopRight"
                          | "lookCorners"
                          | "lookFont"
                          | "lookGradientDirection"
                          | "lookGradientFrom"
                          | "lookGradientOpacity"
                          | "lookGradientTo"
                          | "lookHoverColor"
                          | "lookItalic"
                          | "lookOpacity"
                          | "lookPadding"
                          | "lookShadow"
                          | "lookShadowInner"
                          | "lookSize"
                          | "lookSubtitleAlign"
                          | "lookSubtitleCase"
                          | "lookSubtitleColor"
                          | "lookSubtitleSize"
                          | "lookSubtitleWeight"
                          | "lookTitleColor"
                          | "lookUnderline"
                          | "lookWeight"
                          | "overlay"
                          | "overlayColor",
                          | string
                          | boolean
                          | {
                              $responsive: {
                                desktop: string | boolean;
                                tablet?: string | boolean | undefined;
                                mobile?: string | boolean | undefined;
                              };
                            }
                        >
                      >
                    >
                  | undefined;
                sections: {
                  rhythm: "alternating" | "plain";
                };
                own?:
                  | {
                      id: string & z.$brand<"ThemeId">;
                      name: string;
                    }
                  | undefined;
              };
              layout: import("@webforge/model").LayoutDoc;
              pages: Record<
                string & z.$brand<"PageId">,
                {
                  id: string & z.$brand<"PageId">;
                  kind: "not-found" | "page";
                  slug: string;
                  folder?: string | undefined;
                  title: string;
                  navLabel?: string | undefined;
                  settings: {
                    description?: string | undefined;
                    shareImage?: (string & z.$brand<"MediaId">) | undefined;
                    hideHeader: boolean;
                    hideFooter: boolean;
                    hideFromNavigation: boolean;
                    hideBackToTop?: boolean | undefined;
                    hideFromSearch?: boolean | undefined;
                    privacy?: boolean | undefined;
                    draft?: boolean | undefined;
                  };
                  doc: import("@webforge/model").PageDoc;
                  updated?: string | undefined;
                  collection?: (string & z.$brand<"CollectionId">) | undefined;
                  entry?: Record<string, string> | undefined;
                }
              >;
              pageOrder: (string & z.$brand<"PageId">)[];
              homePageId: string & z.$brand<"PageId">;
              media: Record<
                string & z.$brand<"MediaId">,
                | {
                    id: string & z.$brand<"MediaId">;
                    hash: string;
                    name: string;
                    fileName: string;
                    kind: "image";
                    mimeType: "image/jpeg" | "image/png";
                    width: number;
                    height: number;
                    alt: string;
                    focal?:
                      | {
                          x: number;
                          y: number;
                        }
                      | undefined;
                    crop?:
                      | {
                          x: number;
                          y: number;
                          width: number;
                          height: number;
                        }
                      | undefined;
                  }
                | {
                    id: string & z.$brand<"MediaId">;
                    hash: string;
                    name: string;
                    fileName: string;
                    kind: "file";
                    mimeType:
                      | "application/msword"
                      | "application/pdf"
                      | "application/vnd.ms-excel"
                      | "application/vnd.ms-powerpoint"
                      | "application/vnd.oasis.opendocument.presentation"
                      | "application/vnd.oasis.opendocument.spreadsheet"
                      | "application/vnd.oasis.opendocument.text"
                      | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      | "text/csv"
                      | "text/plain";
                    size?: number | undefined;
                  }
              >;
              code: import("@webforge/model").SiteCode;
              menu: {
                follows: "custom" | "pages";
                items: (
                  | {
                      id: string & z.$brand<"MenuItemId">;
                      hidden: boolean;
                      kind: "page";
                      pageId: string & z.$brand<"PageId">;
                      label?: string | undefined;
                    }
                  | {
                      id: string & z.$brand<"MenuItemId">;
                      hidden: boolean;
                      kind: "link";
                      link:
                        | {
                            kind: "page";
                            pageId: string & z.$brand<"PageId">;
                            anchor?: string | undefined;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "email";
                            address: string;
                            subject?: string | undefined;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "phone";
                            number: string;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "url";
                            href: string;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "file";
                            mediaId: string & z.$brand<"MediaId">;
                            newTab?: boolean | undefined;
                            download?: boolean | undefined;
                          }
                        | {
                            kind: "list";
                            collectionId: string & z.$brand<"CollectionId">;
                            newTab?: boolean | undefined;
                          };
                      label: string;
                    }
                  | {
                      id: string & z.$brand<"MenuItemId">;
                      hidden: boolean;
                      kind: "section";
                      link: {
                        kind: "page";
                        pageId: string & z.$brand<"PageId">;
                        newTab?: boolean | undefined;
                        anchor: string;
                      };
                      label: string;
                    }
                  | {
                      id: string & z.$brand<"MenuItemId">;
                      hidden: boolean;
                      kind: "button";
                      link:
                        | {
                            kind: "page";
                            pageId: string & z.$brand<"PageId">;
                            anchor?: string | undefined;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "email";
                            address: string;
                            subject?: string | undefined;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "phone";
                            number: string;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "url";
                            href: string;
                            newTab?: boolean | undefined;
                          }
                        | {
                            kind: "file";
                            mediaId: string & z.$brand<"MediaId">;
                            newTab?: boolean | undefined;
                            download?: boolean | undefined;
                          }
                        | {
                            kind: "list";
                            collectionId: string & z.$brand<"CollectionId">;
                            newTab?: boolean | undefined;
                          };
                      label: string;
                    }
                  | {
                      id: string & z.$brand<"MenuItemId">;
                      hidden: boolean;
                      kind: "group";
                      label: string;
                      children: (
                        | {
                            id: string & z.$brand<"MenuItemId">;
                            hidden: boolean;
                            kind: "page";
                            pageId: string & z.$brand<"PageId">;
                            label?: string | undefined;
                          }
                        | {
                            id: string & z.$brand<"MenuItemId">;
                            hidden: boolean;
                            kind: "link";
                            link:
                              | {
                                  kind: "page";
                                  pageId: string & z.$brand<"PageId">;
                                  anchor?: string | undefined;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "email";
                                  address: string;
                                  subject?: string | undefined;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "phone";
                                  number: string;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "url";
                                  href: string;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "file";
                                  mediaId: string & z.$brand<"MediaId">;
                                  newTab?: boolean | undefined;
                                  download?: boolean | undefined;
                                }
                              | {
                                  kind: "list";
                                  collectionId: string & z.$brand<"CollectionId">;
                                  newTab?: boolean | undefined;
                                };
                            label: string;
                          }
                        | {
                            id: string & z.$brand<"MenuItemId">;
                            hidden: boolean;
                            kind: "section";
                            link: {
                              kind: "page";
                              pageId: string & z.$brand<"PageId">;
                              newTab?: boolean | undefined;
                              anchor: string;
                            };
                            label: string;
                          }
                        | {
                            id: string & z.$brand<"MenuItemId">;
                            hidden: boolean;
                            kind: "button";
                            link:
                              | {
                                  kind: "page";
                                  pageId: string & z.$brand<"PageId">;
                                  anchor?: string | undefined;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "email";
                                  address: string;
                                  subject?: string | undefined;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "phone";
                                  number: string;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "url";
                                  href: string;
                                  newTab?: boolean | undefined;
                                }
                              | {
                                  kind: "file";
                                  mediaId: string & z.$brand<"MediaId">;
                                  newTab?: boolean | undefined;
                                  download?: boolean | undefined;
                                }
                              | {
                                  kind: "list";
                                  collectionId: string & z.$brand<"CollectionId">;
                                  newTab?: boolean | undefined;
                                };
                            label: string;
                          }
                      )[];
                    }
                )[];
              };
              sharedSections: Record<
                import("@webforge/model").SharedSectionId,
                import("@webforge/model").SharedSection
              >;
              collections: Record<
                string & z.$brand<"CollectionId">,
                {
                  id: string & z.$brand<"CollectionId">;
                  preset: "blog";
                  name: string;
                  folder: string;
                  formerFolders?: string[] | undefined;
                  fields: {
                    name: string;
                    label: string;
                    kind: "date" | "image" | "tags" | "text";
                  }[];
                  design: {
                    before: import("@webforge/model").NodeDoc[];
                    after: import("@webforge/model").NodeDoc[];
                  };
                }
              >;
            },
            unknown
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"none">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"empty">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          invalid: "invalid";
          "newer-format": "newer-format";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** Outcome of reading the open site's documents. */
export type ReadSiteResult = z.infer<typeof readSiteResultSchema>;
/**
 * Why saving changes failed: no site open, another site opened since the renderer loaded
 * (`stale-session`), a read-only site, changes that would break the site, or a write error.
 */
export declare const COMMIT_FAILURES: readonly [
  "no-site",
  "stale-session",
  "read-only",
  "invalid",
  "unknown",
];
/** One of {@link COMMIT_FAILURES}. */
export type CommitFailure = (typeof COMMIT_FAILURES)[number];
/** Outcome of saving changes to the open site. */
declare const commitResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"saved">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          invalid: "invalid";
          "no-site": "no-site";
          "read-only": "read-only";
          "stale-session": "stale-session";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** Outcome of saving changes to the open site. */
export type CommitResult = z.infer<typeof commitResultSchema>;
/**
 * The open site's editor state that isn't part of the site (1.10): remembered with the site, but
 * never versioned or undone. Design changes the layout; Content edits text and images only (M3).
 * What the person ignored in Site Check (3.6) is remembered the same way.
 */
declare const siteUiStateSchema: z.ZodObject<
  {
    editorMode: z.ZodEnum<{
      content: "content";
      design: "design";
    }>;
    siteCheckIgnored: z.ZodOptional<z.ZodArray<z.ZodString>>;
    lastPublishedAt: z.ZodOptional<z.ZodISODateTime>;
    onNetlify: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strict
>;
/** The open site's editor state that isn't part of the site. */
export type SiteUiState = z.infer<typeof siteUiStateSchema>;
/** A change to the editor state: only the parts given are remembered anew. */
declare const siteUiChangeSchema: z.ZodObject<
  {
    editorMode: z.ZodOptional<
      z.ZodEnum<{
        content: "content";
        design: "design";
      }>
    >;
    siteCheckIgnored: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
  },
  z.core.$strict
>;
/** A change to the open site's editor state. */
export type SiteUiChange = z.infer<typeof siteUiChangeSchema>;
/** Outcome of remembering the editor state with the open site. */
declare const uiStateResultSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        status: z.ZodLiteral<"saved">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodLiteral<"failed">;
        reason: z.ZodEnum<{
          "no-site": "no-site";
          "read-only": "read-only";
          "stale-session": "stale-session";
          unknown: "unknown";
        }>;
      },
      z.core.$strict
    >,
  ],
  "status"
>;
/** Outcome of remembering the editor state with the open site. */
export type UiStateResult = z.infer<typeof uiStateResultSchema>;
/**
 * A site's id on the start screen's Recent list (#988): 32 hex digits, made by the main process,
 * which alone knows the path it stands for.
 */
export declare const recentSiteIdSchema: z.ZodString;
/** A site on the start screen's Recent list (F-SITE-2); its path stays in the main process. */
declare const recentSiteSchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    fileName: z.ZodString;
    folder: z.ZodString;
    lastOpened: z.ZodISODateTime;
    lastEdited: z.ZodNullable<z.ZodISODateTime>;
    thumbnail: z.ZodNullable<z.ZodString>;
    missing: z.ZodBoolean;
    pinned: z.ZodBoolean;
    open: z.ZodBoolean;
  },
  z.core.$strict
>;
/** A site on the start screen's Recent list. */
export type RecentSite = z.infer<typeof recentSiteSchema>;
/**
 * The longest paragraph the quick start's *Tell us about your business* takes (QS-7, #873): what
 * the assistant drafts the new site's home and About pages' words from.
 */
export declare const BUSINESS_ABOUT_MAX = 2000;
/**
 * What New Site makes (2.14a, F-SITE-1): a site named `name` (the save dialog's file name too), in
 * theme preset `theme`, from `template`, or the Blank site without one. Main checks the preset.
 * With `business`, the person's own (QS-2, 3.11), the template's sample business is replaced by
 * it and the name; *Try an example* sends none, and keeps the example's.
 */
declare const newSiteRequestSchema: z.ZodObject<
  {
    name: z.ZodString;
    theme: z.ZodString;
    template: z.ZodOptional<
      z.ZodEnum<{
        blank: "blank";
        cafe: "cafe";
        consultant: "consultant";
        personal: "personal";
        photographer: "photographer";
        salon: "salon";
        shop: "shop";
        trades: "trades";
      }>
    >;
    business: z.ZodOptional<
      z.ZodObject<
        {
          email: z.ZodOptional<z.ZodOptional<z.ZodEmail>>;
          phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
          address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
          openingHours: z.ZodOptional<
            z.ZodArray<
              z.ZodObject<
                {
                  days: z.ZodArray<
                    z.ZodEnum<{
                      fri: "fri";
                      mon: "mon";
                      sat: "sat";
                      sun: "sun";
                      thu: "thu";
                      tue: "tue";
                      wed: "wed";
                    }>
                  >;
                  opens: z.ZodString;
                  closes: z.ZodString;
                },
                z.core.$strict
              >
            >
          >;
          description: z.ZodOptional<z.ZodString>;
          webAddress: z.ZodOptional<z.ZodURL>;
          businessType: z.ZodOptional<
            z.ZodEnum<{
              beauty: "beauty";
              creative: "creative";
              food: "food";
              personal: "personal";
              services: "services";
              shop: "shop";
              trades: "trades";
            }>
          >;
          businessKind: z.ZodOptional<
            z.ZodEnum<{
              [x: string]: string;
            }>
          >;
        },
        z.core.$strict
      >
    >;
    pages: z.ZodOptional<
      z.ZodObject<
        {
          leaveOut: z.ZodArray<z.ZodString>;
          recipes: z.ZodArray<z.ZodString>;
          onePage: z.ZodOptional<z.ZodBoolean>;
        },
        z.core.$strict
      >
    >;
    themeTokens: z.ZodOptional<
      z.ZodObject<
        {
          preset: z.ZodString;
          scheme: z.ZodEnum<{
            dark: "dark";
            light: "light";
          }>;
          colors: z.ZodRecord<
            z.ZodEnum<{
              accent: "accent";
              "accent-content": "accent-content";
              "base-100": "base-100";
              "base-200": "base-200";
              "base-300": "base-300";
              "base-content": "base-content";
              error: "error";
              "error-content": "error-content";
              info: "info";
              "info-content": "info-content";
              neutral: "neutral";
              "neutral-content": "neutral-content";
              primary: "primary";
              "primary-content": "primary-content";
              secondary: "secondary";
              "secondary-content": "secondary-content";
              success: "success";
              "success-content": "success-content";
              warning: "warning";
              "warning-content": "warning-content";
            }>,
            z.ZodObject<
              {
                l: z.ZodNumber;
                c: z.ZodNumber;
                h: z.ZodNumber;
              },
              z.core.$strict
            >
          >;
          inverse: z.ZodOptional<
            z.ZodRecord<
              z.ZodEnum<{
                accent: "accent";
                "accent-content": "accent-content";
                "base-100": "base-100";
                "base-200": "base-200";
                "base-300": "base-300";
                "base-content": "base-content";
                error: "error";
                "error-content": "error-content";
                info: "info";
                "info-content": "info-content";
                neutral: "neutral";
                "neutral-content": "neutral-content";
                primary: "primary";
                "primary-content": "primary-content";
                secondary: "secondary";
                "secondary-content": "secondary-content";
                success: "success";
                "success-content": "success-content";
                warning: "warning";
                "warning-content": "warning-content";
              }>,
              z.ZodObject<
                {
                  l: z.ZodNumber;
                  c: z.ZodNumber;
                  h: z.ZodNumber;
                },
                z.core.$strict
              >
            >
          >;
          ownColors: z.ZodOptional<
            z.ZodArray<
              z.ZodObject<
                {
                  id: z.ZodString;
                  name: z.ZodString;
                  color: z.ZodObject<
                    {
                      l: z.ZodNumber;
                      c: z.ZodNumber;
                      h: z.ZodNumber;
                    },
                    z.core.$strict
                  >;
                },
                z.core.$strict
              >
            >
          >;
          fonts: z.ZodObject<
            {
              heading: z.ZodObject<
                {
                  family: z.ZodString;
                  fallback: z.ZodEnum<{
                    monospace: "monospace";
                    "sans-serif": "sans-serif";
                    serif: "serif";
                  }>;
                },
                z.core.$strict
              >;
              body: z.ZodObject<
                {
                  family: z.ZodString;
                  fallback: z.ZodEnum<{
                    monospace: "monospace";
                    "sans-serif": "sans-serif";
                    serif: "serif";
                  }>;
                },
                z.core.$strict
              >;
              accent: z.ZodObject<
                {
                  family: z.ZodString;
                  fallback: z.ZodEnum<{
                    monospace: "monospace";
                    "sans-serif": "sans-serif";
                    serif: "serif";
                  }>;
                },
                z.core.$strict
              >;
            },
            z.core.$strict
          >;
          radius: z.ZodObject<
            {
              box: z.ZodEnum<{
                full: "full";
                l: "l";
                m: "m";
                none: "none";
                s: "s";
                xl: "xl";
              }>;
              field: z.ZodEnum<{
                full: "full";
                l: "l";
                m: "m";
                none: "none";
                s: "s";
                xl: "xl";
              }>;
              selector: z.ZodEnum<{
                full: "full";
                l: "l";
                m: "m";
                none: "none";
                s: "s";
                xl: "xl";
              }>;
            },
            z.core.$strict
          >;
          border: z.ZodEnum<{
            thick: "thick";
            thin: "thin";
          }>;
          effects: z.ZodObject<
            {
              depth: z.ZodBoolean;
              noise: z.ZodBoolean;
            },
            z.core.$strict
          >;
          spacing: z.ZodEnum<{
            compact: "compact";
            normal: "normal";
            roomy: "roomy";
          }>;
          typeScale: z.ZodRecord<
            z.ZodEnum<{
              body: "body";
              h1: "h1";
              h2: "h2";
              h3: "h3";
              h4: "h4";
              h5: "h5";
              h6: "h6";
              small: "small";
            }>,
            z.ZodObject<
              {
                size: z.ZodEnum<{
                  "2xl": "2xl";
                  "3xl": "3xl";
                  "4xl": "4xl";
                  "5xl": "5xl";
                  "6xl": "6xl";
                  base: "base";
                  lg: "lg";
                  sm: "sm";
                  xl: "xl";
                  xs: "xs";
                }>;
                weight: z.ZodNumber;
                leading: z.ZodEnum<{
                  normal: "normal";
                  relaxed: "relaxed";
                  tight: "tight";
                }>;
              },
              z.core.$strict
            >
          >;
          links: z.ZodObject<
            {
              underline: z.ZodPreprocess<
                z.ZodEnum<{
                  always: "always";
                  hover: "hover";
                }>,
                unknown
              >;
            },
            z.core.$strict
          >;
          buttons: z.ZodObject<
            {
              shape: z.ZodEnum<{
                pill: "pill";
                rounded: "rounded";
                square: "square";
              }>;
              size: z.ZodEnum<{
                l: "l";
                m: "m";
                s: "s";
              }>;
              style: z.ZodEnum<{
                filled: "filled";
                ghost: "ghost";
                outline: "outline";
              }>;
            },
            z.core.$strict
          >;
          shadow: z.ZodEnum<{
            none: "none";
            soft: "soft";
            strong: "strong";
          }>;
          headings: z.ZodObject<
            {
              case: z.ZodEnum<{
                normal: "normal";
                "small-caps": "small-caps";
                uppercase: "uppercase";
              }>;
              tracking: z.ZodEnum<{
                normal: "normal";
                tight: "tight";
                wide: "wide";
              }>;
            },
            z.core.$strict
          >;
          cards: z.ZodObject<
            {
              style: z.ZodEnum<{
                flat: "flat";
                outlined: "outlined";
                raised: "raised";
              }>;
            },
            z.core.$strict
          >;
          images: z.ZodObject<
            {
              corners: z.ZodEnum<{
                rounded: "rounded";
                soft: "soft";
                square: "square";
              }>;
            },
            z.core.$strict
          >;
          looks: z.ZodOptional<
            z.ZodRecord<
              z.ZodString,
              z.ZodRecord<
                z.ZodEnum<{
                  hover: "hover";
                  hoverEasing: "hoverEasing";
                  hoverSpeed: "hoverSpeed";
                  lookAlign: "lookAlign";
                  lookBackground: "lookBackground";
                  lookBorder: "lookBorder";
                  lookBorderBottom: "lookBorderBottom";
                  lookBorderColor: "lookBorderColor";
                  lookBorderLeft: "lookBorderLeft";
                  lookBorderRight: "lookBorderRight";
                  lookBorderStyle: "lookBorderStyle";
                  lookBorderTop: "lookBorderTop";
                  lookCase: "lookCase";
                  lookColor: "lookColor";
                  lookCornerBottomLeft: "lookCornerBottomLeft";
                  lookCornerBottomRight: "lookCornerBottomRight";
                  lookCornerTopLeft: "lookCornerTopLeft";
                  lookCornerTopRight: "lookCornerTopRight";
                  lookCorners: "lookCorners";
                  lookFont: "lookFont";
                  lookGradientDirection: "lookGradientDirection";
                  lookGradientFrom: "lookGradientFrom";
                  lookGradientOpacity: "lookGradientOpacity";
                  lookGradientTo: "lookGradientTo";
                  lookHoverColor: "lookHoverColor";
                  lookItalic: "lookItalic";
                  lookOpacity: "lookOpacity";
                  lookPadding: "lookPadding";
                  lookShadow: "lookShadow";
                  lookShadowInner: "lookShadowInner";
                  lookSize: "lookSize";
                  lookSubtitleAlign: "lookSubtitleAlign";
                  lookSubtitleCase: "lookSubtitleCase";
                  lookSubtitleColor: "lookSubtitleColor";
                  lookSubtitleSize: "lookSubtitleSize";
                  lookSubtitleWeight: "lookSubtitleWeight";
                  lookTitleColor: "lookTitleColor";
                  lookUnderline: "lookUnderline";
                  lookWeight: "lookWeight";
                  overlay: "overlay";
                  overlayColor: "overlayColor";
                }> &
                  z.core.$partial,
                z.ZodUnion<
                  readonly [
                    z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>,
                    z.ZodObject<
                      {
                        $responsive: z.ZodObject<
                          {
                            desktop: z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>;
                            tablet: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
                            mobile: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
                          },
                          z.core.$strict
                        >;
                      },
                      z.core.$strict
                    >,
                  ]
                >
              >
            >
          >;
          sections: z.ZodObject<
            {
              rhythm: z.ZodEnum<{
                alternating: "alternating";
                plain: "plain";
              }>;
            },
            z.core.$strict
          >;
          own: z.ZodOptional<
            z.ZodObject<
              {
                id: z.core.$ZodBranded<z.ZodString, "ThemeId", "out">;
                name: z.ZodString;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
    about: z.ZodOptional<z.ZodString>;
    fromBrief: z.ZodOptional<z.ZodLiteral<true>>;
  },
  z.core.$strict
>;
/** See {@link newSiteRequestSchema}. */
export type NewSiteRequest = z.infer<typeof newSiteRequestSchema>;
/** IPC channels of the `project` domain (`project:*`). */
export declare const projectChannels: {
  /** Asks where to save a new site (save dialog in main), creates it and makes it current. */
  readonly createProject: {
    readonly channel: "project:create";
    readonly request: z.ZodTuple<
      [
        z.ZodObject<
          {
            name: z.ZodString;
            theme: z.ZodString;
            template: z.ZodOptional<
              z.ZodEnum<{
                blank: "blank";
                cafe: "cafe";
                consultant: "consultant";
                personal: "personal";
                photographer: "photographer";
                salon: "salon";
                shop: "shop";
                trades: "trades";
              }>
            >;
            business: z.ZodOptional<
              z.ZodObject<
                {
                  email: z.ZodOptional<z.ZodOptional<z.ZodEmail>>;
                  phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                  address: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                  openingHours: z.ZodOptional<
                    z.ZodArray<
                      z.ZodObject<
                        {
                          days: z.ZodArray<
                            z.ZodEnum<{
                              fri: "fri";
                              mon: "mon";
                              sat: "sat";
                              sun: "sun";
                              thu: "thu";
                              tue: "tue";
                              wed: "wed";
                            }>
                          >;
                          opens: z.ZodString;
                          closes: z.ZodString;
                        },
                        z.core.$strict
                      >
                    >
                  >;
                  description: z.ZodOptional<z.ZodString>;
                  webAddress: z.ZodOptional<z.ZodURL>;
                  businessType: z.ZodOptional<
                    z.ZodEnum<{
                      beauty: "beauty";
                      creative: "creative";
                      food: "food";
                      personal: "personal";
                      services: "services";
                      shop: "shop";
                      trades: "trades";
                    }>
                  >;
                  businessKind: z.ZodOptional<
                    z.ZodEnum<{
                      [x: string]: string;
                    }>
                  >;
                },
                z.core.$strict
              >
            >;
            pages: z.ZodOptional<
              z.ZodObject<
                {
                  leaveOut: z.ZodArray<z.ZodString>;
                  recipes: z.ZodArray<z.ZodString>;
                  onePage: z.ZodOptional<z.ZodBoolean>;
                },
                z.core.$strict
              >
            >;
            themeTokens: z.ZodOptional<
              z.ZodObject<
                {
                  preset: z.ZodString;
                  scheme: z.ZodEnum<{
                    dark: "dark";
                    light: "light";
                  }>;
                  colors: z.ZodRecord<
                    z.ZodEnum<{
                      accent: "accent";
                      "accent-content": "accent-content";
                      "base-100": "base-100";
                      "base-200": "base-200";
                      "base-300": "base-300";
                      "base-content": "base-content";
                      error: "error";
                      "error-content": "error-content";
                      info: "info";
                      "info-content": "info-content";
                      neutral: "neutral";
                      "neutral-content": "neutral-content";
                      primary: "primary";
                      "primary-content": "primary-content";
                      secondary: "secondary";
                      "secondary-content": "secondary-content";
                      success: "success";
                      "success-content": "success-content";
                      warning: "warning";
                      "warning-content": "warning-content";
                    }>,
                    z.ZodObject<
                      {
                        l: z.ZodNumber;
                        c: z.ZodNumber;
                        h: z.ZodNumber;
                      },
                      z.core.$strict
                    >
                  >;
                  inverse: z.ZodOptional<
                    z.ZodRecord<
                      z.ZodEnum<{
                        accent: "accent";
                        "accent-content": "accent-content";
                        "base-100": "base-100";
                        "base-200": "base-200";
                        "base-300": "base-300";
                        "base-content": "base-content";
                        error: "error";
                        "error-content": "error-content";
                        info: "info";
                        "info-content": "info-content";
                        neutral: "neutral";
                        "neutral-content": "neutral-content";
                        primary: "primary";
                        "primary-content": "primary-content";
                        secondary: "secondary";
                        "secondary-content": "secondary-content";
                        success: "success";
                        "success-content": "success-content";
                        warning: "warning";
                        "warning-content": "warning-content";
                      }>,
                      z.ZodObject<
                        {
                          l: z.ZodNumber;
                          c: z.ZodNumber;
                          h: z.ZodNumber;
                        },
                        z.core.$strict
                      >
                    >
                  >;
                  ownColors: z.ZodOptional<
                    z.ZodArray<
                      z.ZodObject<
                        {
                          id: z.ZodString;
                          name: z.ZodString;
                          color: z.ZodObject<
                            {
                              l: z.ZodNumber;
                              c: z.ZodNumber;
                              h: z.ZodNumber;
                            },
                            z.core.$strict
                          >;
                        },
                        z.core.$strict
                      >
                    >
                  >;
                  fonts: z.ZodObject<
                    {
                      heading: z.ZodObject<
                        {
                          family: z.ZodString;
                          fallback: z.ZodEnum<{
                            monospace: "monospace";
                            "sans-serif": "sans-serif";
                            serif: "serif";
                          }>;
                        },
                        z.core.$strict
                      >;
                      body: z.ZodObject<
                        {
                          family: z.ZodString;
                          fallback: z.ZodEnum<{
                            monospace: "monospace";
                            "sans-serif": "sans-serif";
                            serif: "serif";
                          }>;
                        },
                        z.core.$strict
                      >;
                      accent: z.ZodObject<
                        {
                          family: z.ZodString;
                          fallback: z.ZodEnum<{
                            monospace: "monospace";
                            "sans-serif": "sans-serif";
                            serif: "serif";
                          }>;
                        },
                        z.core.$strict
                      >;
                    },
                    z.core.$strict
                  >;
                  radius: z.ZodObject<
                    {
                      box: z.ZodEnum<{
                        full: "full";
                        l: "l";
                        m: "m";
                        none: "none";
                        s: "s";
                        xl: "xl";
                      }>;
                      field: z.ZodEnum<{
                        full: "full";
                        l: "l";
                        m: "m";
                        none: "none";
                        s: "s";
                        xl: "xl";
                      }>;
                      selector: z.ZodEnum<{
                        full: "full";
                        l: "l";
                        m: "m";
                        none: "none";
                        s: "s";
                        xl: "xl";
                      }>;
                    },
                    z.core.$strict
                  >;
                  border: z.ZodEnum<{
                    thick: "thick";
                    thin: "thin";
                  }>;
                  effects: z.ZodObject<
                    {
                      depth: z.ZodBoolean;
                      noise: z.ZodBoolean;
                    },
                    z.core.$strict
                  >;
                  spacing: z.ZodEnum<{
                    compact: "compact";
                    normal: "normal";
                    roomy: "roomy";
                  }>;
                  typeScale: z.ZodRecord<
                    z.ZodEnum<{
                      body: "body";
                      h1: "h1";
                      h2: "h2";
                      h3: "h3";
                      h4: "h4";
                      h5: "h5";
                      h6: "h6";
                      small: "small";
                    }>,
                    z.ZodObject<
                      {
                        size: z.ZodEnum<{
                          "2xl": "2xl";
                          "3xl": "3xl";
                          "4xl": "4xl";
                          "5xl": "5xl";
                          "6xl": "6xl";
                          base: "base";
                          lg: "lg";
                          sm: "sm";
                          xl: "xl";
                          xs: "xs";
                        }>;
                        weight: z.ZodNumber;
                        leading: z.ZodEnum<{
                          normal: "normal";
                          relaxed: "relaxed";
                          tight: "tight";
                        }>;
                      },
                      z.core.$strict
                    >
                  >;
                  links: z.ZodObject<
                    {
                      underline: z.ZodPreprocess<
                        z.ZodEnum<{
                          always: "always";
                          hover: "hover";
                        }>,
                        unknown
                      >;
                    },
                    z.core.$strict
                  >;
                  buttons: z.ZodObject<
                    {
                      shape: z.ZodEnum<{
                        pill: "pill";
                        rounded: "rounded";
                        square: "square";
                      }>;
                      size: z.ZodEnum<{
                        l: "l";
                        m: "m";
                        s: "s";
                      }>;
                      style: z.ZodEnum<{
                        filled: "filled";
                        ghost: "ghost";
                        outline: "outline";
                      }>;
                    },
                    z.core.$strict
                  >;
                  shadow: z.ZodEnum<{
                    none: "none";
                    soft: "soft";
                    strong: "strong";
                  }>;
                  headings: z.ZodObject<
                    {
                      case: z.ZodEnum<{
                        normal: "normal";
                        "small-caps": "small-caps";
                        uppercase: "uppercase";
                      }>;
                      tracking: z.ZodEnum<{
                        normal: "normal";
                        tight: "tight";
                        wide: "wide";
                      }>;
                    },
                    z.core.$strict
                  >;
                  cards: z.ZodObject<
                    {
                      style: z.ZodEnum<{
                        flat: "flat";
                        outlined: "outlined";
                        raised: "raised";
                      }>;
                    },
                    z.core.$strict
                  >;
                  images: z.ZodObject<
                    {
                      corners: z.ZodEnum<{
                        rounded: "rounded";
                        soft: "soft";
                        square: "square";
                      }>;
                    },
                    z.core.$strict
                  >;
                  looks: z.ZodOptional<
                    z.ZodRecord<
                      z.ZodString,
                      z.ZodRecord<
                        z.ZodEnum<{
                          hover: "hover";
                          hoverEasing: "hoverEasing";
                          hoverSpeed: "hoverSpeed";
                          lookAlign: "lookAlign";
                          lookBackground: "lookBackground";
                          lookBorder: "lookBorder";
                          lookBorderBottom: "lookBorderBottom";
                          lookBorderColor: "lookBorderColor";
                          lookBorderLeft: "lookBorderLeft";
                          lookBorderRight: "lookBorderRight";
                          lookBorderStyle: "lookBorderStyle";
                          lookBorderTop: "lookBorderTop";
                          lookCase: "lookCase";
                          lookColor: "lookColor";
                          lookCornerBottomLeft: "lookCornerBottomLeft";
                          lookCornerBottomRight: "lookCornerBottomRight";
                          lookCornerTopLeft: "lookCornerTopLeft";
                          lookCornerTopRight: "lookCornerTopRight";
                          lookCorners: "lookCorners";
                          lookFont: "lookFont";
                          lookGradientDirection: "lookGradientDirection";
                          lookGradientFrom: "lookGradientFrom";
                          lookGradientOpacity: "lookGradientOpacity";
                          lookGradientTo: "lookGradientTo";
                          lookHoverColor: "lookHoverColor";
                          lookItalic: "lookItalic";
                          lookOpacity: "lookOpacity";
                          lookPadding: "lookPadding";
                          lookShadow: "lookShadow";
                          lookShadowInner: "lookShadowInner";
                          lookSize: "lookSize";
                          lookSubtitleAlign: "lookSubtitleAlign";
                          lookSubtitleCase: "lookSubtitleCase";
                          lookSubtitleColor: "lookSubtitleColor";
                          lookSubtitleSize: "lookSubtitleSize";
                          lookSubtitleWeight: "lookSubtitleWeight";
                          lookTitleColor: "lookTitleColor";
                          lookUnderline: "lookUnderline";
                          lookWeight: "lookWeight";
                          overlay: "overlay";
                          overlayColor: "overlayColor";
                        }> &
                          z.core.$partial,
                        z.ZodUnion<
                          readonly [
                            z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>,
                            z.ZodObject<
                              {
                                $responsive: z.ZodObject<
                                  {
                                    desktop: z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>;
                                    tablet: z.ZodOptional<
                                      z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>
                                    >;
                                    mobile: z.ZodOptional<
                                      z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>
                                    >;
                                  },
                                  z.core.$strict
                                >;
                              },
                              z.core.$strict
                            >,
                          ]
                        >
                      >
                    >
                  >;
                  sections: z.ZodObject<
                    {
                      rhythm: z.ZodEnum<{
                        alternating: "alternating";
                        plain: "plain";
                      }>;
                    },
                    z.core.$strict
                  >;
                  own: z.ZodOptional<
                    z.ZodObject<
                      {
                        id: z.core.$ZodBranded<z.ZodString, "ThemeId", "out">;
                        name: z.ZodString;
                      },
                      z.core.$strict
                    >
                  >;
                },
                z.core.$strict
              >
            >;
            about: z.ZodOptional<z.ZodString>;
            fromBrief: z.ZodOptional<z.ZodLiteral<true>>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"opened">;
            project: z.ZodObject<
              {
                sessionId: z.ZodUUID;
                name: z.ZodString;
                fileName: z.ZodString;
                formatVersion: z.ZodInt;
                syncService: z.ZodNullable<
                  z.ZodEnum<{
                    dropbox: "dropbox";
                    "google-drive": "google-drive";
                    icloud: "icloud";
                    onedrive: "onedrive";
                  }>
                >;
              },
              z.core.$strict
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"canceled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              corrupt: "corrupt";
              "newer-format": "newer-format";
              "not-a-project": "not-a-project";
              "not-found": "not-found";
              "too-large": "too-large";
              "unexpected-schema": "unexpected-schema";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** Asks which site to open (open dialog in main) and makes it current. */
  readonly openProject: {
    readonly channel: "project:open";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"opened">;
            project: z.ZodObject<
              {
                sessionId: z.ZodUUID;
                name: z.ZodString;
                fileName: z.ZodString;
                formatVersion: z.ZodInt;
                syncService: z.ZodNullable<
                  z.ZodEnum<{
                    dropbox: "dropbox";
                    "google-drive": "google-drive";
                    icloud: "icloud";
                    onedrive: "onedrive";
                  }>
                >;
              },
              z.core.$strict
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"canceled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              corrupt: "corrupt";
              "newer-format": "newer-format";
              "not-a-project": "not-a-project";
              "not-found": "not-found";
              "too-large": "too-large";
              "unexpected-schema": "unexpected-schema";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /**
   * Saves a copy of the open site as a ZIP (4.7, F-SITE-5): its last changes first, then where
   * the person chooses in a save dialog. `canceled` once another site has opened (#663).
   */
  readonly saveSiteZip: {
    readonly channel: "project:save-zip";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"saved">;
            fileName: z.ZodString;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"canceled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "no-site": "no-site";
              "own-file": "own-file";
              "too-large": "too-large";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /**
   * Asks which site's ZIP to open (open dialog in main), checks it, asks where to save it as a new
   * site (save dialog) and makes that current (4.7).
   */
  readonly openSiteZip: {
    readonly channel: "project:open-zip";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"opened">;
            project: z.ZodObject<
              {
                sessionId: z.ZodUUID;
                name: z.ZodString;
                fileName: z.ZodString;
                formatVersion: z.ZodInt;
                syncService: z.ZodNullable<
                  z.ZodEnum<{
                    dropbox: "dropbox";
                    "google-drive": "google-drive";
                    icloud: "icloud";
                    onedrive: "onedrive";
                  }>
                >;
              },
              z.core.$strict
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"canceled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              corrupt: "corrupt";
              "newer-format": "newer-format";
              "not-a-project": "not-a-project";
              "not-found": "not-found";
              "too-large": "too-large";
              "unexpected-schema": "unexpected-schema";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /**
   * The quick start's *Tell us about your business* for the site opened as the session given, once
   * (QS-7, #873): `null` for any other opening, and after the first call. Main forgets it then.
   */
  readonly takeBusinessAbout: {
    readonly channel: "project:take-about";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodNullable<z.ZodString>;
  };
  /**
   * Closes the site opened as the session given (File › Close Site, #1016): its last changes saved
   * and its canvas kept for the Recent list first, as before another site replaces it. Nothing for
   * an opening another has replaced (#663).
   */
  readonly closeProject: {
    readonly channel: "project:close";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodNull;
  };
  /** The site that is open, or `null`. */
  readonly getCurrentProject: {
    readonly channel: "project:get-current";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodNullable<
      z.ZodObject<
        {
          sessionId: z.ZodUUID;
          name: z.ZodString;
          fileName: z.ZodString;
          formatVersion: z.ZodInt;
          syncService: z.ZodNullable<
            z.ZodEnum<{
              dropbox: "dropbox";
              "google-drive": "google-drive";
              icloud: "icloud";
              onedrive: "onedrive";
            }>
          >;
        },
        z.core.$strict
      >
    >;
  };
  /** The open site's documents as one validated `SiteDoc`, migrated to the current format. */
  readonly readSite: {
    readonly channel: "project:read-site";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"ok">;
            site: z.ZodType<
              {
                formatVersion: 17;
                settings: {
                  general: {
                    name: string;
                    description?: string | undefined;
                    language: string;
                    icon?: (string & z.$brand<"MediaId">) | undefined;
                    backToTop?: boolean | undefined;
                    businessType?:
                      | "beauty"
                      | "creative"
                      | "food"
                      | "personal"
                      | "services"
                      | "shop"
                      | "trades"
                      | undefined;
                    businessKind?: string | undefined;
                    labels?: Record<string, string> | undefined;
                  };
                  address: {
                    url?: string | undefined;
                  };
                  social: {
                    profiles: {
                      network:
                        | "custom"
                        | "facebook"
                        | "github"
                        | "instagram"
                        | "linkedin"
                        | "tiktok"
                        | "x"
                        | "youtube";
                      url: string;
                    }[];
                    shareImage?: (string & z.$brand<"MediaId">) | undefined;
                    xHandle?: string | undefined;
                  };
                  contact: {
                    businessName?: string | undefined;
                    email?: string | undefined;
                    phone?: string | undefined;
                    address?: string | undefined;
                    openingHours: {
                      days: ("fri" | "mon" | "sat" | "sun" | "thu" | "tue" | "wed")[];
                      opens: string;
                      closes: string;
                    }[];
                    openingHoursNote?: string | undefined;
                    priceRange?: string | undefined;
                    geo?:
                      | {
                          latitude: number;
                          longitude: number;
                        }
                      | undefined;
                  };
                  search: {
                    allowIndexing: boolean;
                    includeSitemap: boolean;
                    readableByAi?: boolean | undefined;
                    askNoAiTraining?: boolean | undefined;
                    verification?:
                      | {
                          google?: string | undefined;
                          bing?: string | undefined;
                        }
                      | undefined;
                    keptAddresses?:
                      | {
                          from: string;
                          page: string & z.$brand<"PageId">;
                        }[]
                      | undefined;
                  };
                  analytics: {
                    measurementId?: string | undefined;
                    consentBanner: boolean;
                    consentMessage?: string | undefined;
                  };
                  forms: {
                    service?:
                      | {
                          kind: "formspree";
                          formId: string;
                        }
                      | {
                          kind: "web3forms";
                          accessKey: string;
                        }
                      | {
                          kind: "formsubmit";
                          email: string;
                        }
                      | {
                          kind: "netlify";
                        }
                      | {
                          kind: "custom";
                          url: string;
                        }
                      | undefined;
                  };
                  allowedExternalUrls: string[];
                };
                theme: {
                  preset: string;
                  scheme: "dark" | "light";
                  colors: Record<
                    | "accent"
                    | "accent-content"
                    | "base-100"
                    | "base-200"
                    | "base-300"
                    | "base-content"
                    | "error"
                    | "error-content"
                    | "info"
                    | "info-content"
                    | "neutral"
                    | "neutral-content"
                    | "primary"
                    | "primary-content"
                    | "secondary"
                    | "secondary-content"
                    | "success"
                    | "success-content"
                    | "warning"
                    | "warning-content",
                    {
                      l: number;
                      c: number;
                      h: number;
                    }
                  >;
                  inverse?:
                    | Record<
                        | "accent"
                        | "accent-content"
                        | "base-100"
                        | "base-200"
                        | "base-300"
                        | "base-content"
                        | "error"
                        | "error-content"
                        | "info"
                        | "info-content"
                        | "neutral"
                        | "neutral-content"
                        | "primary"
                        | "primary-content"
                        | "secondary"
                        | "secondary-content"
                        | "success"
                        | "success-content"
                        | "warning"
                        | "warning-content",
                        {
                          l: number;
                          c: number;
                          h: number;
                        }
                      >
                    | undefined;
                  ownColors?:
                    | {
                        id: string;
                        name: string;
                        color: {
                          l: number;
                          c: number;
                          h: number;
                        };
                      }[]
                    | undefined;
                  fonts: {
                    heading: {
                      family: string;
                      fallback: "monospace" | "sans-serif" | "serif";
                    };
                    body: {
                      family: string;
                      fallback: "monospace" | "sans-serif" | "serif";
                    };
                    accent: {
                      family: string;
                      fallback: "monospace" | "sans-serif" | "serif";
                    };
                  };
                  radius: {
                    box: "full" | "l" | "m" | "none" | "s" | "xl";
                    field: "full" | "l" | "m" | "none" | "s" | "xl";
                    selector: "full" | "l" | "m" | "none" | "s" | "xl";
                  };
                  border: "thick" | "thin";
                  effects: {
                    depth: boolean;
                    noise: boolean;
                  };
                  spacing: "compact" | "normal" | "roomy";
                  typeScale: Record<
                    "body" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "small",
                    {
                      size:
                        | "2xl"
                        | "3xl"
                        | "4xl"
                        | "5xl"
                        | "6xl"
                        | "base"
                        | "lg"
                        | "sm"
                        | "xl"
                        | "xs";
                      weight: number;
                      leading: "normal" | "relaxed" | "tight";
                    }
                  >;
                  links: {
                    underline: "always" | "hover";
                  };
                  buttons: {
                    shape: "pill" | "rounded" | "square";
                    size: "l" | "m" | "s";
                    style: "filled" | "ghost" | "outline";
                  };
                  shadow: "none" | "soft" | "strong";
                  headings: {
                    case: "normal" | "small-caps" | "uppercase";
                    tracking: "normal" | "tight" | "wide";
                  };
                  cards: {
                    style: "flat" | "outlined" | "raised";
                  };
                  images: {
                    corners: "rounded" | "soft" | "square";
                  };
                  looks?:
                    | Record<
                        string,
                        Partial<
                          Record<
                            | "hover"
                            | "hoverEasing"
                            | "hoverSpeed"
                            | "lookAlign"
                            | "lookBackground"
                            | "lookBorder"
                            | "lookBorderBottom"
                            | "lookBorderColor"
                            | "lookBorderLeft"
                            | "lookBorderRight"
                            | "lookBorderStyle"
                            | "lookBorderTop"
                            | "lookCase"
                            | "lookColor"
                            | "lookCornerBottomLeft"
                            | "lookCornerBottomRight"
                            | "lookCornerTopLeft"
                            | "lookCornerTopRight"
                            | "lookCorners"
                            | "lookFont"
                            | "lookGradientDirection"
                            | "lookGradientFrom"
                            | "lookGradientOpacity"
                            | "lookGradientTo"
                            | "lookHoverColor"
                            | "lookItalic"
                            | "lookOpacity"
                            | "lookPadding"
                            | "lookShadow"
                            | "lookShadowInner"
                            | "lookSize"
                            | "lookSubtitleAlign"
                            | "lookSubtitleCase"
                            | "lookSubtitleColor"
                            | "lookSubtitleSize"
                            | "lookSubtitleWeight"
                            | "lookTitleColor"
                            | "lookUnderline"
                            | "lookWeight"
                            | "overlay"
                            | "overlayColor",
                            | string
                            | boolean
                            | {
                                $responsive: {
                                  desktop: string | boolean;
                                  tablet?: string | boolean | undefined;
                                  mobile?: string | boolean | undefined;
                                };
                              }
                          >
                        >
                      >
                    | undefined;
                  sections: {
                    rhythm: "alternating" | "plain";
                  };
                  own?:
                    | {
                        id: string & z.$brand<"ThemeId">;
                        name: string;
                      }
                    | undefined;
                };
                layout: import("@webforge/model").LayoutDoc;
                pages: Record<
                  string & z.$brand<"PageId">,
                  {
                    id: string & z.$brand<"PageId">;
                    kind: "not-found" | "page";
                    slug: string;
                    folder?: string | undefined;
                    title: string;
                    navLabel?: string | undefined;
                    settings: {
                      description?: string | undefined;
                      shareImage?: (string & z.$brand<"MediaId">) | undefined;
                      hideHeader: boolean;
                      hideFooter: boolean;
                      hideFromNavigation: boolean;
                      hideBackToTop?: boolean | undefined;
                      hideFromSearch?: boolean | undefined;
                      privacy?: boolean | undefined;
                      draft?: boolean | undefined;
                    };
                    doc: import("@webforge/model").PageDoc;
                    updated?: string | undefined;
                    collection?: (string & z.$brand<"CollectionId">) | undefined;
                    entry?: Record<string, string> | undefined;
                  }
                >;
                pageOrder: (string & z.$brand<"PageId">)[];
                homePageId: string & z.$brand<"PageId">;
                media: Record<
                  string & z.$brand<"MediaId">,
                  | {
                      id: string & z.$brand<"MediaId">;
                      hash: string;
                      name: string;
                      fileName: string;
                      kind: "image";
                      mimeType: "image/jpeg" | "image/png";
                      width: number;
                      height: number;
                      alt: string;
                      focal?:
                        | {
                            x: number;
                            y: number;
                          }
                        | undefined;
                      crop?:
                        | {
                            x: number;
                            y: number;
                            width: number;
                            height: number;
                          }
                        | undefined;
                    }
                  | {
                      id: string & z.$brand<"MediaId">;
                      hash: string;
                      name: string;
                      fileName: string;
                      kind: "file";
                      mimeType:
                        | "application/msword"
                        | "application/pdf"
                        | "application/vnd.ms-excel"
                        | "application/vnd.ms-powerpoint"
                        | "application/vnd.oasis.opendocument.presentation"
                        | "application/vnd.oasis.opendocument.spreadsheet"
                        | "application/vnd.oasis.opendocument.text"
                        | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        | "text/csv"
                        | "text/plain";
                      size?: number | undefined;
                    }
                >;
                code: import("@webforge/model").SiteCode;
                menu: {
                  follows: "custom" | "pages";
                  items: (
                    | {
                        id: string & z.$brand<"MenuItemId">;
                        hidden: boolean;
                        kind: "page";
                        pageId: string & z.$brand<"PageId">;
                        label?: string | undefined;
                      }
                    | {
                        id: string & z.$brand<"MenuItemId">;
                        hidden: boolean;
                        kind: "link";
                        link:
                          | {
                              kind: "page";
                              pageId: string & z.$brand<"PageId">;
                              anchor?: string | undefined;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "email";
                              address: string;
                              subject?: string | undefined;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "phone";
                              number: string;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "url";
                              href: string;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "file";
                              mediaId: string & z.$brand<"MediaId">;
                              newTab?: boolean | undefined;
                              download?: boolean | undefined;
                            }
                          | {
                              kind: "list";
                              collectionId: string & z.$brand<"CollectionId">;
                              newTab?: boolean | undefined;
                            };
                        label: string;
                      }
                    | {
                        id: string & z.$brand<"MenuItemId">;
                        hidden: boolean;
                        kind: "section";
                        link: {
                          kind: "page";
                          pageId: string & z.$brand<"PageId">;
                          newTab?: boolean | undefined;
                          anchor: string;
                        };
                        label: string;
                      }
                    | {
                        id: string & z.$brand<"MenuItemId">;
                        hidden: boolean;
                        kind: "button";
                        link:
                          | {
                              kind: "page";
                              pageId: string & z.$brand<"PageId">;
                              anchor?: string | undefined;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "email";
                              address: string;
                              subject?: string | undefined;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "phone";
                              number: string;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "url";
                              href: string;
                              newTab?: boolean | undefined;
                            }
                          | {
                              kind: "file";
                              mediaId: string & z.$brand<"MediaId">;
                              newTab?: boolean | undefined;
                              download?: boolean | undefined;
                            }
                          | {
                              kind: "list";
                              collectionId: string & z.$brand<"CollectionId">;
                              newTab?: boolean | undefined;
                            };
                        label: string;
                      }
                    | {
                        id: string & z.$brand<"MenuItemId">;
                        hidden: boolean;
                        kind: "group";
                        label: string;
                        children: (
                          | {
                              id: string & z.$brand<"MenuItemId">;
                              hidden: boolean;
                              kind: "page";
                              pageId: string & z.$brand<"PageId">;
                              label?: string | undefined;
                            }
                          | {
                              id: string & z.$brand<"MenuItemId">;
                              hidden: boolean;
                              kind: "link";
                              link:
                                | {
                                    kind: "page";
                                    pageId: string & z.$brand<"PageId">;
                                    anchor?: string | undefined;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "email";
                                    address: string;
                                    subject?: string | undefined;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "phone";
                                    number: string;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "url";
                                    href: string;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "file";
                                    mediaId: string & z.$brand<"MediaId">;
                                    newTab?: boolean | undefined;
                                    download?: boolean | undefined;
                                  }
                                | {
                                    kind: "list";
                                    collectionId: string & z.$brand<"CollectionId">;
                                    newTab?: boolean | undefined;
                                  };
                              label: string;
                            }
                          | {
                              id: string & z.$brand<"MenuItemId">;
                              hidden: boolean;
                              kind: "section";
                              link: {
                                kind: "page";
                                pageId: string & z.$brand<"PageId">;
                                newTab?: boolean | undefined;
                                anchor: string;
                              };
                              label: string;
                            }
                          | {
                              id: string & z.$brand<"MenuItemId">;
                              hidden: boolean;
                              kind: "button";
                              link:
                                | {
                                    kind: "page";
                                    pageId: string & z.$brand<"PageId">;
                                    anchor?: string | undefined;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "email";
                                    address: string;
                                    subject?: string | undefined;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "phone";
                                    number: string;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "url";
                                    href: string;
                                    newTab?: boolean | undefined;
                                  }
                                | {
                                    kind: "file";
                                    mediaId: string & z.$brand<"MediaId">;
                                    newTab?: boolean | undefined;
                                    download?: boolean | undefined;
                                  }
                                | {
                                    kind: "list";
                                    collectionId: string & z.$brand<"CollectionId">;
                                    newTab?: boolean | undefined;
                                  };
                              label: string;
                            }
                        )[];
                      }
                  )[];
                };
                sharedSections: Record<
                  import("@webforge/model").SharedSectionId,
                  import("@webforge/model").SharedSection
                >;
                collections: Record<
                  string & z.$brand<"CollectionId">,
                  {
                    id: string & z.$brand<"CollectionId">;
                    preset: "blog";
                    name: string;
                    folder: string;
                    formerFolders?: string[] | undefined;
                    fields: {
                      name: string;
                      label: string;
                      kind: "date" | "image" | "tags" | "text";
                    }[];
                    design: {
                      before: import("@webforge/model").NodeDoc[];
                      after: import("@webforge/model").NodeDoc[];
                    };
                  }
                >;
              },
              unknown,
              z.core.$ZodTypeInternals<
                {
                  formatVersion: 17;
                  settings: {
                    general: {
                      name: string;
                      description?: string | undefined;
                      language: string;
                      icon?: (string & z.$brand<"MediaId">) | undefined;
                      backToTop?: boolean | undefined;
                      businessType?:
                        | "beauty"
                        | "creative"
                        | "food"
                        | "personal"
                        | "services"
                        | "shop"
                        | "trades"
                        | undefined;
                      businessKind?: string | undefined;
                      labels?: Record<string, string> | undefined;
                    };
                    address: {
                      url?: string | undefined;
                    };
                    social: {
                      profiles: {
                        network:
                          | "custom"
                          | "facebook"
                          | "github"
                          | "instagram"
                          | "linkedin"
                          | "tiktok"
                          | "x"
                          | "youtube";
                        url: string;
                      }[];
                      shareImage?: (string & z.$brand<"MediaId">) | undefined;
                      xHandle?: string | undefined;
                    };
                    contact: {
                      businessName?: string | undefined;
                      email?: string | undefined;
                      phone?: string | undefined;
                      address?: string | undefined;
                      openingHours: {
                        days: ("fri" | "mon" | "sat" | "sun" | "thu" | "tue" | "wed")[];
                        opens: string;
                        closes: string;
                      }[];
                      openingHoursNote?: string | undefined;
                      priceRange?: string | undefined;
                      geo?:
                        | {
                            latitude: number;
                            longitude: number;
                          }
                        | undefined;
                    };
                    search: {
                      allowIndexing: boolean;
                      includeSitemap: boolean;
                      readableByAi?: boolean | undefined;
                      askNoAiTraining?: boolean | undefined;
                      verification?:
                        | {
                            google?: string | undefined;
                            bing?: string | undefined;
                          }
                        | undefined;
                      keptAddresses?:
                        | {
                            from: string;
                            page: string & z.$brand<"PageId">;
                          }[]
                        | undefined;
                    };
                    analytics: {
                      measurementId?: string | undefined;
                      consentBanner: boolean;
                      consentMessage?: string | undefined;
                    };
                    forms: {
                      service?:
                        | {
                            kind: "formspree";
                            formId: string;
                          }
                        | {
                            kind: "web3forms";
                            accessKey: string;
                          }
                        | {
                            kind: "formsubmit";
                            email: string;
                          }
                        | {
                            kind: "netlify";
                          }
                        | {
                            kind: "custom";
                            url: string;
                          }
                        | undefined;
                    };
                    allowedExternalUrls: string[];
                  };
                  theme: {
                    preset: string;
                    scheme: "dark" | "light";
                    colors: Record<
                      | "accent"
                      | "accent-content"
                      | "base-100"
                      | "base-200"
                      | "base-300"
                      | "base-content"
                      | "error"
                      | "error-content"
                      | "info"
                      | "info-content"
                      | "neutral"
                      | "neutral-content"
                      | "primary"
                      | "primary-content"
                      | "secondary"
                      | "secondary-content"
                      | "success"
                      | "success-content"
                      | "warning"
                      | "warning-content",
                      {
                        l: number;
                        c: number;
                        h: number;
                      }
                    >;
                    inverse?:
                      | Record<
                          | "accent"
                          | "accent-content"
                          | "base-100"
                          | "base-200"
                          | "base-300"
                          | "base-content"
                          | "error"
                          | "error-content"
                          | "info"
                          | "info-content"
                          | "neutral"
                          | "neutral-content"
                          | "primary"
                          | "primary-content"
                          | "secondary"
                          | "secondary-content"
                          | "success"
                          | "success-content"
                          | "warning"
                          | "warning-content",
                          {
                            l: number;
                            c: number;
                            h: number;
                          }
                        >
                      | undefined;
                    ownColors?:
                      | {
                          id: string;
                          name: string;
                          color: {
                            l: number;
                            c: number;
                            h: number;
                          };
                        }[]
                      | undefined;
                    fonts: {
                      heading: {
                        family: string;
                        fallback: "monospace" | "sans-serif" | "serif";
                      };
                      body: {
                        family: string;
                        fallback: "monospace" | "sans-serif" | "serif";
                      };
                      accent: {
                        family: string;
                        fallback: "monospace" | "sans-serif" | "serif";
                      };
                    };
                    radius: {
                      box: "full" | "l" | "m" | "none" | "s" | "xl";
                      field: "full" | "l" | "m" | "none" | "s" | "xl";
                      selector: "full" | "l" | "m" | "none" | "s" | "xl";
                    };
                    border: "thick" | "thin";
                    effects: {
                      depth: boolean;
                      noise: boolean;
                    };
                    spacing: "compact" | "normal" | "roomy";
                    typeScale: Record<
                      "body" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "small",
                      {
                        size:
                          | "2xl"
                          | "3xl"
                          | "4xl"
                          | "5xl"
                          | "6xl"
                          | "base"
                          | "lg"
                          | "sm"
                          | "xl"
                          | "xs";
                        weight: number;
                        leading: "normal" | "relaxed" | "tight";
                      }
                    >;
                    links: {
                      underline: "always" | "hover";
                    };
                    buttons: {
                      shape: "pill" | "rounded" | "square";
                      size: "l" | "m" | "s";
                      style: "filled" | "ghost" | "outline";
                    };
                    shadow: "none" | "soft" | "strong";
                    headings: {
                      case: "normal" | "small-caps" | "uppercase";
                      tracking: "normal" | "tight" | "wide";
                    };
                    cards: {
                      style: "flat" | "outlined" | "raised";
                    };
                    images: {
                      corners: "rounded" | "soft" | "square";
                    };
                    looks?:
                      | Record<
                          string,
                          Partial<
                            Record<
                              | "hover"
                              | "hoverEasing"
                              | "hoverSpeed"
                              | "lookAlign"
                              | "lookBackground"
                              | "lookBorder"
                              | "lookBorderBottom"
                              | "lookBorderColor"
                              | "lookBorderLeft"
                              | "lookBorderRight"
                              | "lookBorderStyle"
                              | "lookBorderTop"
                              | "lookCase"
                              | "lookColor"
                              | "lookCornerBottomLeft"
                              | "lookCornerBottomRight"
                              | "lookCornerTopLeft"
                              | "lookCornerTopRight"
                              | "lookCorners"
                              | "lookFont"
                              | "lookGradientDirection"
                              | "lookGradientFrom"
                              | "lookGradientOpacity"
                              | "lookGradientTo"
                              | "lookHoverColor"
                              | "lookItalic"
                              | "lookOpacity"
                              | "lookPadding"
                              | "lookShadow"
                              | "lookShadowInner"
                              | "lookSize"
                              | "lookSubtitleAlign"
                              | "lookSubtitleCase"
                              | "lookSubtitleColor"
                              | "lookSubtitleSize"
                              | "lookSubtitleWeight"
                              | "lookTitleColor"
                              | "lookUnderline"
                              | "lookWeight"
                              | "overlay"
                              | "overlayColor",
                              | string
                              | boolean
                              | {
                                  $responsive: {
                                    desktop: string | boolean;
                                    tablet?: string | boolean | undefined;
                                    mobile?: string | boolean | undefined;
                                  };
                                }
                            >
                          >
                        >
                      | undefined;
                    sections: {
                      rhythm: "alternating" | "plain";
                    };
                    own?:
                      | {
                          id: string & z.$brand<"ThemeId">;
                          name: string;
                        }
                      | undefined;
                  };
                  layout: import("@webforge/model").LayoutDoc;
                  pages: Record<
                    string & z.$brand<"PageId">,
                    {
                      id: string & z.$brand<"PageId">;
                      kind: "not-found" | "page";
                      slug: string;
                      folder?: string | undefined;
                      title: string;
                      navLabel?: string | undefined;
                      settings: {
                        description?: string | undefined;
                        shareImage?: (string & z.$brand<"MediaId">) | undefined;
                        hideHeader: boolean;
                        hideFooter: boolean;
                        hideFromNavigation: boolean;
                        hideBackToTop?: boolean | undefined;
                        hideFromSearch?: boolean | undefined;
                        privacy?: boolean | undefined;
                        draft?: boolean | undefined;
                      };
                      doc: import("@webforge/model").PageDoc;
                      updated?: string | undefined;
                      collection?: (string & z.$brand<"CollectionId">) | undefined;
                      entry?: Record<string, string> | undefined;
                    }
                  >;
                  pageOrder: (string & z.$brand<"PageId">)[];
                  homePageId: string & z.$brand<"PageId">;
                  media: Record<
                    string & z.$brand<"MediaId">,
                    | {
                        id: string & z.$brand<"MediaId">;
                        hash: string;
                        name: string;
                        fileName: string;
                        kind: "image";
                        mimeType: "image/jpeg" | "image/png";
                        width: number;
                        height: number;
                        alt: string;
                        focal?:
                          | {
                              x: number;
                              y: number;
                            }
                          | undefined;
                        crop?:
                          | {
                              x: number;
                              y: number;
                              width: number;
                              height: number;
                            }
                          | undefined;
                      }
                    | {
                        id: string & z.$brand<"MediaId">;
                        hash: string;
                        name: string;
                        fileName: string;
                        kind: "file";
                        mimeType:
                          | "application/msword"
                          | "application/pdf"
                          | "application/vnd.ms-excel"
                          | "application/vnd.ms-powerpoint"
                          | "application/vnd.oasis.opendocument.presentation"
                          | "application/vnd.oasis.opendocument.spreadsheet"
                          | "application/vnd.oasis.opendocument.text"
                          | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          | "text/csv"
                          | "text/plain";
                        size?: number | undefined;
                      }
                  >;
                  code: import("@webforge/model").SiteCode;
                  menu: {
                    follows: "custom" | "pages";
                    items: (
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "page";
                          pageId: string & z.$brand<"PageId">;
                          label?: string | undefined;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "link";
                          link:
                            | {
                                kind: "page";
                                pageId: string & z.$brand<"PageId">;
                                anchor?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "email";
                                address: string;
                                subject?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "phone";
                                number: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "url";
                                href: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "file";
                                mediaId: string & z.$brand<"MediaId">;
                                newTab?: boolean | undefined;
                                download?: boolean | undefined;
                              }
                            | {
                                kind: "list";
                                collectionId: string & z.$brand<"CollectionId">;
                                newTab?: boolean | undefined;
                              };
                          label: string;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "section";
                          link: {
                            kind: "page";
                            pageId: string & z.$brand<"PageId">;
                            newTab?: boolean | undefined;
                            anchor: string;
                          };
                          label: string;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "button";
                          link:
                            | {
                                kind: "page";
                                pageId: string & z.$brand<"PageId">;
                                anchor?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "email";
                                address: string;
                                subject?: string | undefined;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "phone";
                                number: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "url";
                                href: string;
                                newTab?: boolean | undefined;
                              }
                            | {
                                kind: "file";
                                mediaId: string & z.$brand<"MediaId">;
                                newTab?: boolean | undefined;
                                download?: boolean | undefined;
                              }
                            | {
                                kind: "list";
                                collectionId: string & z.$brand<"CollectionId">;
                                newTab?: boolean | undefined;
                              };
                          label: string;
                        }
                      | {
                          id: string & z.$brand<"MenuItemId">;
                          hidden: boolean;
                          kind: "group";
                          label: string;
                          children: (
                            | {
                                id: string & z.$brand<"MenuItemId">;
                                hidden: boolean;
                                kind: "page";
                                pageId: string & z.$brand<"PageId">;
                                label?: string | undefined;
                              }
                            | {
                                id: string & z.$brand<"MenuItemId">;
                                hidden: boolean;
                                kind: "link";
                                link:
                                  | {
                                      kind: "page";
                                      pageId: string & z.$brand<"PageId">;
                                      anchor?: string | undefined;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "email";
                                      address: string;
                                      subject?: string | undefined;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "phone";
                                      number: string;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "url";
                                      href: string;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "file";
                                      mediaId: string & z.$brand<"MediaId">;
                                      newTab?: boolean | undefined;
                                      download?: boolean | undefined;
                                    }
                                  | {
                                      kind: "list";
                                      collectionId: string & z.$brand<"CollectionId">;
                                      newTab?: boolean | undefined;
                                    };
                                label: string;
                              }
                            | {
                                id: string & z.$brand<"MenuItemId">;
                                hidden: boolean;
                                kind: "section";
                                link: {
                                  kind: "page";
                                  pageId: string & z.$brand<"PageId">;
                                  newTab?: boolean | undefined;
                                  anchor: string;
                                };
                                label: string;
                              }
                            | {
                                id: string & z.$brand<"MenuItemId">;
                                hidden: boolean;
                                kind: "button";
                                link:
                                  | {
                                      kind: "page";
                                      pageId: string & z.$brand<"PageId">;
                                      anchor?: string | undefined;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "email";
                                      address: string;
                                      subject?: string | undefined;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "phone";
                                      number: string;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "url";
                                      href: string;
                                      newTab?: boolean | undefined;
                                    }
                                  | {
                                      kind: "file";
                                      mediaId: string & z.$brand<"MediaId">;
                                      newTab?: boolean | undefined;
                                      download?: boolean | undefined;
                                    }
                                  | {
                                      kind: "list";
                                      collectionId: string & z.$brand<"CollectionId">;
                                      newTab?: boolean | undefined;
                                    };
                                label: string;
                              }
                          )[];
                        }
                    )[];
                  };
                  sharedSections: Record<
                    import("@webforge/model").SharedSectionId,
                    import("@webforge/model").SharedSection
                  >;
                  collections: Record<
                    string & z.$brand<"CollectionId">,
                    {
                      id: string & z.$brand<"CollectionId">;
                      preset: "blog";
                      name: string;
                      folder: string;
                      formerFolders?: string[] | undefined;
                      fields: {
                        name: string;
                        label: string;
                        kind: "date" | "image" | "tags" | "text";
                      }[];
                      design: {
                        before: import("@webforge/model").NodeDoc[];
                        after: import("@webforge/model").NodeDoc[];
                      };
                    }
                  >;
                },
                unknown
              >
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"none">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"empty">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              invalid: "invalid";
              "newer-format": "newer-format";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /**
   * Saves changed documents of the open site in one transaction (autosave). The main process
   * applies them to the site it holds and saves only if the result is a valid site.
   */
  readonly commitSite: {
    readonly channel: "project:commit";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodArray<
          z.ZodDiscriminatedUnion<
            [
              z.ZodObject<
                {
                  type: z.ZodLiteral<"put">;
                  id: z.ZodString;
                  kind: z.ZodEnum<{
                    code: "code";
                    collections: "collections";
                    layout: "layout";
                    media: "media";
                    menu: "menu";
                    page: "page";
                    settings: "settings";
                    sharedSections: "sharedSections";
                    site: "site";
                    theme: "theme";
                  }>;
                  content: z.ZodUnknown;
                },
                z.core.$strict
              >,
              z.ZodObject<
                {
                  type: z.ZodLiteral<"delete">;
                  id: z.ZodString;
                },
                z.core.$strict
              >,
            ],
            "type"
          >
        >,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"saved">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              invalid: "invalid";
              "no-site": "no-site";
              "read-only": "read-only";
              "stale-session": "stale-session";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** The open site's editor state (Design or Content mode), or `null` without an open site. */
  /** The Recent list, most recently opened first. */
  readonly listRecentSites: {
    readonly channel: "project:list-recent";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          name: z.ZodString;
          fileName: z.ZodString;
          folder: z.ZodString;
          lastOpened: z.ZodISODateTime;
          lastEdited: z.ZodNullable<z.ZodISODateTime>;
          thumbnail: z.ZodNullable<z.ZodString>;
          missing: z.ZodBoolean;
          pinned: z.ZodBoolean;
          open: z.ZodBoolean;
        },
        z.core.$strict
      >
    >;
  };
  /** Opens a site from the Recent list by its id; a missing file is taken off the list. */
  readonly openRecentSite: {
    readonly channel: "project:open-recent";
    readonly request: z.ZodTuple<[z.ZodString], null>;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"opened">;
            project: z.ZodObject<
              {
                sessionId: z.ZodUUID;
                name: z.ZodString;
                fileName: z.ZodString;
                formatVersion: z.ZodInt;
                syncService: z.ZodNullable<
                  z.ZodEnum<{
                    dropbox: "dropbox";
                    "google-drive": "google-drive";
                    icloud: "icloud";
                    onedrive: "onedrive";
                  }>
                >;
              },
              z.core.$strict
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"canceled">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              corrupt: "corrupt";
              "newer-format": "newer-format";
              "not-a-project": "not-a-project";
              "not-found": "not-found";
              "too-large": "too-large";
              "unexpected-schema": "unexpected-schema";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** Pins a site to the top of the Recent list, or unpins it (2.14b). */
  readonly pinRecentSite: {
    readonly channel: "project:pin-recent";
    readonly request: z.ZodTuple<[z.ZodString, z.ZodBoolean], null>;
    readonly response: z.ZodNull;
  };
  /** Takes a site off the Recent list; its file is untouched. */
  readonly removeRecentSite: {
    readonly channel: "project:remove-recent";
    readonly request: z.ZodTuple<[z.ZodString], null>;
    readonly response: z.ZodNull;
  };
  /** Takes every site off the Recent list but the pinned ones (3.18, Clear Recent). */
  readonly clearRecentSites: {
    readonly channel: "project:clear-recent";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodNull;
  };
  readonly getUiState: {
    readonly channel: "project:get-ui-state";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodNullable<
      z.ZodObject<
        {
          editorMode: z.ZodEnum<{
            content: "content";
            design: "design";
          }>;
          siteCheckIgnored: z.ZodOptional<z.ZodArray<z.ZodString>>;
          lastPublishedAt: z.ZodOptional<z.ZodISODateTime>;
          onNetlify: z.ZodOptional<z.ZodBoolean>;
        },
        z.core.$strict
      >
    >;
  };
  /** Remembers the editor state with the open site. */
  readonly setUiState: {
    readonly channel: "project:set-ui-state";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodObject<
          {
            editorMode: z.ZodOptional<
              z.ZodEnum<{
                content: "content";
                design: "design";
              }>
            >;
            siteCheckIgnored: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            status: z.ZodLiteral<"saved">;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodLiteral<"failed">;
            reason: z.ZodEnum<{
              "no-site": "no-site";
              "read-only": "read-only";
              "stale-session": "stale-session";
              unknown: "unknown";
            }>;
          },
          z.core.$strict
        >,
      ],
      "status"
    >;
  };
  /** The renderer's answer to `app:flush`: every change is saved, the window may close. */
  readonly projectFlushed: {
    readonly channel: "project:flushed";
    readonly request: z.ZodTuple<[z.ZodInt], null>;
    readonly response: z.ZodNull;
  };
  /** The renderer's answer to `app:site-picture`'s `draw`: whether the home page is drawn (#1175). */
  readonly sitePictureDrawn: {
    readonly channel: "project:site-picture-drawn";
    readonly request: z.ZodTuple<[z.ZodInt, z.ZodBoolean], null>;
    readonly response: z.ZodNull;
  };
};
/** `window.webforge.project`. */
export interface ProjectApi {
  /** Shows a save dialog, then creates the site New Site asked for there and opens it. */
  create(request: NewSiteRequest): Promise<ProjectResult>;
  /** Shows an open dialog, then opens the chosen site. */
  open(): Promise<ProjectResult>;
  /** Saves a copy of the site opened as `sessionId` as a ZIP, where the person chooses (4.7). */
  saveZip(sessionId: string): Promise<SaveSiteZipResult>;
  /** Opens a site's ZIP the person chooses as a new site, saved where they choose (4.7). */
  openZip(): Promise<ProjectResult>;
  /**
   * The quick start's *Tell us about your business* for the site opened as `sessionId`, once
   * (QS-7): `null` for another opening, or once taken.
   */
  takeBusinessAbout(sessionId: string): Promise<string | null>;
  /** The site that is open, or `null`. */
  getCurrent(): Promise<ProjectSummary | null>;
  /** The open site's documents as one validated site. */
  readSite(): Promise<ReadSiteResult>;
  /**
   * Saves changed documents of the open site, e.g. from `changedDocuments(previous, next)`, if it
   * is still the opening `sessionId` names.
   */
  commit(sessionId: string, changes: readonly SiteDocumentChange[]): Promise<CommitResult>;
  /** The open site's editor state (Design or Content mode), or `null` without an open site. */
  getUiState(): Promise<SiteUiState | null>;
  /** The start screen's Recent list. */
  listRecent(): Promise<RecentSite[]>;
  /** Opens a site from the Recent list. */
  openRecent(id: string): Promise<ProjectResult>;
  /** Pins a site to the top of the Recent list, or unpins it. */
  pinRecent(id: string, pinned: boolean): Promise<null>;
  /** Takes a site off the Recent list. */
  removeRecent(id: string): Promise<null>;
  /** Takes every unpinned site off the Recent list. */
  clearRecent(): Promise<null>;
  /** Closes the site opened as `sessionId`, saved first (File › Close Site, #1016). */
  close(sessionId: string): Promise<null>;
  /** Remembers the editor state with the open site, if it is still the opening `sessionId` names. */
  setUiState(sessionId: string, change: SiteUiChange): Promise<UiStateResult>;
}
//# sourceMappingURL=project.d.ts.map
