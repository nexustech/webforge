import { z } from "zod";

/**
 * What the main process asks the export worker to do. The snapshot names its images and
 * documents by hash: the worker asks for each one's bytes as the build reaches it (`read-blob`,
 * worker-channel-protocol.ts), so neither process holds them all (R15).
 */
declare const exportJobSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"export">;
    snapshot: z.ZodType<
      import("@webforge/model").SiteSnapshot,
      unknown,
      z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
    >;
    destination: z.ZodString;
    format: z.ZodEnum<{
      folder: "folder";
      zip: "zip";
    }>;
    output: z.ZodObject<
      {
        minify: z.ZodBoolean;
        developerFiles: z.ZodBoolean;
      },
      z.core.$strict
    >;
    fonts: z.ZodArray<
      z.ZodObject<
        {
          file: z.ZodString;
          data: z.ZodInstanceOf<Uint8Array<ArrayBuffer>>;
        },
        z.core.$strict
      >
    >;
    families: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          family: z.ZodString;
          category: z.ZodEnum<{
            display: "display";
            handwriting: "handwriting";
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          fallback: z.ZodEnum<{
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          licence: z.ZodEnum<{
            "Apache-2.0": "Apache-2.0";
            "OFL-1.1": "OFL-1.1";
            "UFL-1.0": "UFL-1.0";
          }>;
          variable: z.ZodBoolean;
          weights: z.ZodArray<z.ZodNumber>;
          styles: z.ZodArray<
            z.ZodEnum<{
              italic: "italic";
              normal: "normal";
            }>
          >;
          package: z.ZodString;
          version: z.ZodString;
          files: z.ZodArray<
            z.ZodObject<
              {
                file: z.ZodString;
                subset: z.ZodEnum<{
                  latin: "latin";
                  "latin-ext": "latin-ext";
                }>;
                style: z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>;
                weight: z.ZodUnion<
                  readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                >;
                unicodeRange: z.ZodString;
                bytes: z.ZodNumber;
                sha256: z.ZodString;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
  },
  z.core.$strict
>;
/** What the main process asks the export worker to do. */
export type ExportJob = z.infer<typeof exportJobSchema>;
/**
 * Builds the open site for the preview server (3.2), in memory: the snapshot, fonts and families
 * as an export's, and nothing written anywhere. The preview worker keeps the files of its last
 * build, to answer with only those that changed.
 */
declare const previewJobSchema: z.ZodObject<
  {
    snapshot: z.ZodType<
      import("@webforge/model").SiteSnapshot,
      unknown,
      z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
    >;
    fonts: z.ZodArray<
      z.ZodObject<
        {
          file: z.ZodString;
          data: z.ZodInstanceOf<Uint8Array<ArrayBuffer>>;
        },
        z.core.$strict
      >
    >;
    families: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          family: z.ZodString;
          category: z.ZodEnum<{
            display: "display";
            handwriting: "handwriting";
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          fallback: z.ZodEnum<{
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          licence: z.ZodEnum<{
            "Apache-2.0": "Apache-2.0";
            "OFL-1.1": "OFL-1.1";
            "UFL-1.0": "UFL-1.0";
          }>;
          variable: z.ZodBoolean;
          weights: z.ZodArray<z.ZodNumber>;
          styles: z.ZodArray<
            z.ZodEnum<{
              italic: "italic";
              normal: "normal";
            }>
          >;
          package: z.ZodString;
          version: z.ZodString;
          files: z.ZodArray<
            z.ZodObject<
              {
                file: z.ZodString;
                subset: z.ZodEnum<{
                  latin: "latin";
                  "latin-ext": "latin-ext";
                }>;
                style: z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>;
                weight: z.ZodUnion<
                  readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                >;
                unicodeRange: z.ZodString;
                bytes: z.ZodNumber;
                sha256: z.ZodString;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
    type: z.ZodLiteral<"preview">;
  },
  z.core.$strict
>;
/** Builds the open site for the preview server. */
export type PreviewJob = z.infer<typeof previewJobSchema>;
/**
 * Publishes a site to a destination (4.5, ADR 0018 §1): the site main read from the file and
 * gated, the destination with the sign-in main read from the keychain for this job only, and what
 * this computer trusts about it. The worker makes the snapshot (§3), builds it and uploads it; it
 * holds the sign-in for the job and never logs it, nor puts it in an outcome.
 */
declare const publishJobSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"publish">;
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
        unknown
      >
    >;
    destination: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            id: z.ZodUUID;
            name: z.ZodString;
            kind: z.ZodLiteral<"file-transfer">;
            settings: z.ZodDiscriminatedUnion<
              [
                z.ZodObject<
                  {
                    host: z.ZodPipe<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                    >;
                    port: z.ZodOptional<z.ZodNumber>;
                    user: z.ZodString;
                    folder: z.ZodString;
                    url: z.ZodOptional<z.ZodURL>;
                    redirectRules: z.ZodOptional<z.ZodBoolean>;
                    protocol: z.ZodEnum<{
                      ftp: "ftp";
                      ftps: "ftps";
                    }>;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    host: z.ZodPipe<
                      z.ZodString,
                      z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                    >;
                    port: z.ZodOptional<z.ZodNumber>;
                    user: z.ZodString;
                    folder: z.ZodString;
                    url: z.ZodOptional<z.ZodURL>;
                    redirectRules: z.ZodOptional<z.ZodBoolean>;
                    protocol: z.ZodLiteral<"sftp">;
                    signIn: z.ZodEnum<{
                      key: "key";
                      password: "password";
                    }>;
                  },
                  z.core.$strict
                >,
              ],
              "protocol"
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            id: z.ZodUUID;
            name: z.ZodString;
            kind: z.ZodLiteral<"netlify">;
            siteId: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodURL>;
          },
          z.core.$strict
        >,
      ],
      "kind"
    >;
    signIn: z.ZodUnion<
      readonly [
        z.ZodUnion<
          readonly [
            z.ZodObject<
              {
                password: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                privateKey: z.ZodString;
                passphrase: z.ZodOptional<z.ZodString>;
              },
              z.core.$strict
            >,
          ]
        >,
        z.ZodObject<
          {
            token: z.ZodString;
          },
          z.core.$strict
        >,
      ]
    >;
    trust: z.ZodObject<
      {
        hostKey: z.ZodOptional<z.ZodString>;
        plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
      },
      z.core.$strict
    >;
    target: z.ZodObject<
      {
        site: z.ZodObject<
          {
            projectId: z.ZodString;
            destinationId: z.ZodString;
          },
          z.core.$strict
        >;
        replaceOtherSite: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strict
    >;
    trustedCode: z.ZodArray<z.ZodString>;
    fonts: z.ZodArray<
      z.ZodObject<
        {
          file: z.ZodString;
          data: z.ZodInstanceOf<Uint8Array<ArrayBuffer>>;
        },
        z.core.$strict
      >
    >;
    families: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          family: z.ZodString;
          category: z.ZodEnum<{
            display: "display";
            handwriting: "handwriting";
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          fallback: z.ZodEnum<{
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          licence: z.ZodEnum<{
            "Apache-2.0": "Apache-2.0";
            "OFL-1.1": "OFL-1.1";
            "UFL-1.0": "UFL-1.0";
          }>;
          variable: z.ZodBoolean;
          weights: z.ZodArray<z.ZodNumber>;
          styles: z.ZodArray<
            z.ZodEnum<{
              italic: "italic";
              normal: "normal";
            }>
          >;
          package: z.ZodString;
          version: z.ZodString;
          files: z.ZodArray<
            z.ZodObject<
              {
                file: z.ZodString;
                subset: z.ZodEnum<{
                  latin: "latin";
                  "latin-ext": "latin-ext";
                }>;
                style: z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>;
                weight: z.ZodUnion<
                  readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                >;
                unicodeRange: z.ZodString;
                bytes: z.ZodNumber;
                sha256: z.ZodString;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
    netlifyApi: z.ZodOptional<z.ZodURL>;
    restore: z.ZodOptional<z.ZodString>;
  },
  z.core.$strict
>;
/** Publishes a site to a destination. */
export type PublishJob = z.infer<typeof publishJobSchema>;
/** Custom property names (`--text-xl`), plain ones only, as `cssVariablesUsed` gives them (6.8). */
export declare const cssVariableNamesSchema: z.ZodArray<z.ZodString>;
/** Compiles the site CSS for the canvas; a long-lived worker answers many of these (1.12). */
declare const compileCssJobSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"compile-css">;
    theme: z.ZodType<
      {
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
      },
      unknown,
      z.core.$ZodTypeInternals<
        {
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
        },
        unknown
      >
    >;
    candidates: z.ZodArray<z.ZodString>;
    variables: z.ZodOptional<z.ZodArray<z.ZodString>>;
    families: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          family: z.ZodString;
          category: z.ZodEnum<{
            display: "display";
            handwriting: "handwriting";
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          fallback: z.ZodEnum<{
            monospace: "monospace";
            "sans-serif": "sans-serif";
            serif: "serif";
          }>;
          licence: z.ZodEnum<{
            "Apache-2.0": "Apache-2.0";
            "OFL-1.1": "OFL-1.1";
            "UFL-1.0": "UFL-1.0";
          }>;
          variable: z.ZodBoolean;
          weights: z.ZodArray<z.ZodNumber>;
          styles: z.ZodArray<
            z.ZodEnum<{
              italic: "italic";
              normal: "normal";
            }>
          >;
          package: z.ZodString;
          version: z.ZodString;
          files: z.ZodArray<
            z.ZodObject<
              {
                file: z.ZodString;
                subset: z.ZodEnum<{
                  latin: "latin";
                  "latin-ext": "latin-ext";
                }>;
                style: z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>;
                weight: z.ZodUnion<
                  readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                >;
                unicodeRange: z.ZodString;
                bytes: z.ZodNumber;
                sha256: z.ZodString;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
  },
  z.core.$strict
>;
/** Compiles the site CSS for the canvas. */
export type CompileCssJob = z.infer<typeof compileCssJobSchema>;
/**
 * Lists every class the site's styles support, for the Edit panel's CSS classes field (#276). The
 * canvas styles worker answers it, from the same Tailwind setup as the site's CSS.
 */
declare const classCatalogueJobSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"class-catalogue">;
    theme: z.ZodType<
      {
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
      },
      unknown,
      z.core.$ZodTypeInternals<
        {
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
        },
        unknown
      >
    >;
  },
  z.core.$strict
>;
/** Lists every class the site's styles support. */
export type ClassCatalogueJob = z.infer<typeof classCatalogueJobSchema>;
/** At most this many classes in one {@link ClassCssJob}: what one view of the list shows. */
export declare const MAX_CLASS_CSS = 200;
/** A class name as the CSS classes field holds one: no spaces, nothing longer than this. */
export declare const classNameSchema: z.ZodString;
/** The CSS each class produces, for the class browser's previews and the unknown-class warning. */
declare const classCssJobSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"class-css">;
    theme: z.ZodType<
      {
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
      },
      unknown,
      z.core.$ZodTypeInternals<
        {
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
        },
        unknown
      >
    >;
    classes: z.ZodArray<z.ZodString>;
  },
  z.core.$strict
>;
/** The CSS each class produces. */
export type ClassCssJob = z.infer<typeof classCssJobSchema>;
/**
 * What Advanced mode's CSS tab asks for (3.14): one item of a page as the export writes it. The
 * canvas styles worker answers it with the pipeline's own rendering. The snapshot has no image
 * sizes, so they come with it, by Media id: no image is read.
 */
export declare const itemHtmlRequestSchema: z.ZodObject<
  {
    snapshot: z.ZodType<
      import("@webforge/model").SiteSnapshot,
      unknown,
      z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
    >;
    sizes: z.ZodRecord<
      z.ZodString,
      z.ZodObject<
        {
          width: z.ZodInt;
          height: z.ZodInt;
        },
        z.core.$strict
      >
    >;
    pageId: z.ZodString;
    nodeId: z.ZodString;
  },
  z.core.$strict
>;
/** An item of a page to write as the export would. */
export type ItemHtmlRequest = z.infer<typeof itemHtmlRequestSchema>;
declare const itemHtmlJobSchema: z.ZodObject<
  {
    snapshot: z.ZodType<
      import("@webforge/model").SiteSnapshot,
      unknown,
      z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
    >;
    sizes: z.ZodRecord<
      z.ZodString,
      z.ZodObject<
        {
          width: z.ZodInt;
          height: z.ZodInt;
        },
        z.core.$strict
      >
    >;
    pageId: z.ZodString;
    nodeId: z.ZodString;
    type: z.ZodLiteral<"item-html">;
  },
  z.core.$strict
>;
/** An item of a page to write as the export would, in the canvas styles worker. */
export type ItemHtmlJob = z.infer<typeof itemHtmlJobSchema>;
/** Bytes of any buffer kind (a Node `Buffer` too), which `z.instanceof` would narrow. */
export declare const bytesSchema: z.ZodCustom<
  Uint8Array<ArrayBufferLike>,
  Uint8Array<ArrayBufferLike>
>;
/** Makes the editor's preview of a Media image (1.16); a long-lived worker answers many. */
declare const thumbnailJobSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"thumbnail">;
    mimeType: z.ZodEnum<{
      "image/jpeg": "image/jpeg";
      "image/png": "image/png";
    }>;
    data: z.ZodCustom<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>>;
  },
  z.core.$strict
>;
/** Makes the editor's preview of a Media image. */
export type ThumbnailJob = z.infer<typeof thumbnailJobSchema>;
/** Any job the worker accepts. */
export declare const workerJobSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"export">;
        snapshot: z.ZodType<
          import("@webforge/model").SiteSnapshot,
          unknown,
          z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
        >;
        destination: z.ZodString;
        format: z.ZodEnum<{
          folder: "folder";
          zip: "zip";
        }>;
        output: z.ZodObject<
          {
            minify: z.ZodBoolean;
            developerFiles: z.ZodBoolean;
          },
          z.core.$strict
        >;
        fonts: z.ZodArray<
          z.ZodObject<
            {
              file: z.ZodString;
              data: z.ZodInstanceOf<Uint8Array<ArrayBuffer>>;
            },
            z.core.$strict
          >
        >;
        families: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              family: z.ZodString;
              category: z.ZodEnum<{
                display: "display";
                handwriting: "handwriting";
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              fallback: z.ZodEnum<{
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              licence: z.ZodEnum<{
                "Apache-2.0": "Apache-2.0";
                "OFL-1.1": "OFL-1.1";
                "UFL-1.0": "UFL-1.0";
              }>;
              variable: z.ZodBoolean;
              weights: z.ZodArray<z.ZodNumber>;
              styles: z.ZodArray<
                z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>
              >;
              package: z.ZodString;
              version: z.ZodString;
              files: z.ZodArray<
                z.ZodObject<
                  {
                    file: z.ZodString;
                    subset: z.ZodEnum<{
                      latin: "latin";
                      "latin-ext": "latin-ext";
                    }>;
                    style: z.ZodEnum<{
                      italic: "italic";
                      normal: "normal";
                    }>;
                    weight: z.ZodUnion<
                      readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                    >;
                    unicodeRange: z.ZodString;
                    bytes: z.ZodNumber;
                    sha256: z.ZodString;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        snapshot: z.ZodType<
          import("@webforge/model").SiteSnapshot,
          unknown,
          z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
        >;
        fonts: z.ZodArray<
          z.ZodObject<
            {
              file: z.ZodString;
              data: z.ZodInstanceOf<Uint8Array<ArrayBuffer>>;
            },
            z.core.$strict
          >
        >;
        families: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              family: z.ZodString;
              category: z.ZodEnum<{
                display: "display";
                handwriting: "handwriting";
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              fallback: z.ZodEnum<{
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              licence: z.ZodEnum<{
                "Apache-2.0": "Apache-2.0";
                "OFL-1.1": "OFL-1.1";
                "UFL-1.0": "UFL-1.0";
              }>;
              variable: z.ZodBoolean;
              weights: z.ZodArray<z.ZodNumber>;
              styles: z.ZodArray<
                z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>
              >;
              package: z.ZodString;
              version: z.ZodString;
              files: z.ZodArray<
                z.ZodObject<
                  {
                    file: z.ZodString;
                    subset: z.ZodEnum<{
                      latin: "latin";
                      "latin-ext": "latin-ext";
                    }>;
                    style: z.ZodEnum<{
                      italic: "italic";
                      normal: "normal";
                    }>;
                    weight: z.ZodUnion<
                      readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                    >;
                    unicodeRange: z.ZodString;
                    bytes: z.ZodNumber;
                    sha256: z.ZodString;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
        type: z.ZodLiteral<"preview">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"publish">;
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
        destination: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                id: z.ZodUUID;
                name: z.ZodString;
                kind: z.ZodLiteral<"file-transfer">;
                settings: z.ZodDiscriminatedUnion<
                  [
                    z.ZodObject<
                      {
                        host: z.ZodPipe<
                          z.ZodString,
                          z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                        >;
                        port: z.ZodOptional<z.ZodNumber>;
                        user: z.ZodString;
                        folder: z.ZodString;
                        url: z.ZodOptional<z.ZodURL>;
                        redirectRules: z.ZodOptional<z.ZodBoolean>;
                        protocol: z.ZodEnum<{
                          ftp: "ftp";
                          ftps: "ftps";
                        }>;
                      },
                      z.core.$strict
                    >,
                    z.ZodObject<
                      {
                        host: z.ZodPipe<
                          z.ZodString,
                          z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6, z.ZodString]>
                        >;
                        port: z.ZodOptional<z.ZodNumber>;
                        user: z.ZodString;
                        folder: z.ZodString;
                        url: z.ZodOptional<z.ZodURL>;
                        redirectRules: z.ZodOptional<z.ZodBoolean>;
                        protocol: z.ZodLiteral<"sftp">;
                        signIn: z.ZodEnum<{
                          key: "key";
                          password: "password";
                        }>;
                      },
                      z.core.$strict
                    >,
                  ],
                  "protocol"
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                id: z.ZodUUID;
                name: z.ZodString;
                kind: z.ZodLiteral<"netlify">;
                siteId: z.ZodOptional<z.ZodString>;
                url: z.ZodOptional<z.ZodURL>;
              },
              z.core.$strict
            >,
          ],
          "kind"
        >;
        signIn: z.ZodUnion<
          readonly [
            z.ZodUnion<
              readonly [
                z.ZodObject<
                  {
                    password: z.ZodString;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    privateKey: z.ZodString;
                    passphrase: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >,
              ]
            >,
            z.ZodObject<
              {
                token: z.ZodString;
              },
              z.core.$strict
            >,
          ]
        >;
        trust: z.ZodObject<
          {
            hostKey: z.ZodOptional<z.ZodString>;
            plainFtpWarned: z.ZodOptional<z.ZodLiteral<true>>;
          },
          z.core.$strict
        >;
        target: z.ZodObject<
          {
            site: z.ZodObject<
              {
                projectId: z.ZodString;
                destinationId: z.ZodString;
              },
              z.core.$strict
            >;
            replaceOtherSite: z.ZodOptional<z.ZodBoolean>;
          },
          z.core.$strict
        >;
        trustedCode: z.ZodArray<z.ZodString>;
        fonts: z.ZodArray<
          z.ZodObject<
            {
              file: z.ZodString;
              data: z.ZodInstanceOf<Uint8Array<ArrayBuffer>>;
            },
            z.core.$strict
          >
        >;
        families: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              family: z.ZodString;
              category: z.ZodEnum<{
                display: "display";
                handwriting: "handwriting";
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              fallback: z.ZodEnum<{
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              licence: z.ZodEnum<{
                "Apache-2.0": "Apache-2.0";
                "OFL-1.1": "OFL-1.1";
                "UFL-1.0": "UFL-1.0";
              }>;
              variable: z.ZodBoolean;
              weights: z.ZodArray<z.ZodNumber>;
              styles: z.ZodArray<
                z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>
              >;
              package: z.ZodString;
              version: z.ZodString;
              files: z.ZodArray<
                z.ZodObject<
                  {
                    file: z.ZodString;
                    subset: z.ZodEnum<{
                      latin: "latin";
                      "latin-ext": "latin-ext";
                    }>;
                    style: z.ZodEnum<{
                      italic: "italic";
                      normal: "normal";
                    }>;
                    weight: z.ZodUnion<
                      readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                    >;
                    unicodeRange: z.ZodString;
                    bytes: z.ZodNumber;
                    sha256: z.ZodString;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
        netlifyApi: z.ZodOptional<z.ZodURL>;
        restore: z.ZodOptional<z.ZodString>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"compile-css">;
        theme: z.ZodType<
          {
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
          },
          unknown,
          z.core.$ZodTypeInternals<
            {
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
            },
            unknown
          >
        >;
        candidates: z.ZodArray<z.ZodString>;
        variables: z.ZodOptional<z.ZodArray<z.ZodString>>;
        families: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              family: z.ZodString;
              category: z.ZodEnum<{
                display: "display";
                handwriting: "handwriting";
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              fallback: z.ZodEnum<{
                monospace: "monospace";
                "sans-serif": "sans-serif";
                serif: "serif";
              }>;
              licence: z.ZodEnum<{
                "Apache-2.0": "Apache-2.0";
                "OFL-1.1": "OFL-1.1";
                "UFL-1.0": "UFL-1.0";
              }>;
              variable: z.ZodBoolean;
              weights: z.ZodArray<z.ZodNumber>;
              styles: z.ZodArray<
                z.ZodEnum<{
                  italic: "italic";
                  normal: "normal";
                }>
              >;
              package: z.ZodString;
              version: z.ZodString;
              files: z.ZodArray<
                z.ZodObject<
                  {
                    file: z.ZodString;
                    subset: z.ZodEnum<{
                      latin: "latin";
                      "latin-ext": "latin-ext";
                    }>;
                    style: z.ZodEnum<{
                      italic: "italic";
                      normal: "normal";
                    }>;
                    weight: z.ZodUnion<
                      readonly [z.ZodNumber, z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>]
                    >;
                    unicodeRange: z.ZodString;
                    bytes: z.ZodNumber;
                    sha256: z.ZodString;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"class-catalogue">;
        theme: z.ZodType<
          {
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
          },
          unknown,
          z.core.$ZodTypeInternals<
            {
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
            },
            unknown
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"class-css">;
        theme: z.ZodType<
          {
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
          },
          unknown,
          z.core.$ZodTypeInternals<
            {
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
            },
            unknown
          >
        >;
        classes: z.ZodArray<z.ZodString>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        snapshot: z.ZodType<
          import("@webforge/model").SiteSnapshot,
          unknown,
          z.core.$ZodTypeInternals<import("@webforge/model").SiteSnapshot, unknown>
        >;
        sizes: z.ZodRecord<
          z.ZodString,
          z.ZodObject<
            {
              width: z.ZodInt;
              height: z.ZodInt;
            },
            z.core.$strict
          >
        >;
        pageId: z.ZodString;
        nodeId: z.ZodString;
        type: z.ZodLiteral<"item-html">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"thumbnail">;
        mimeType: z.ZodEnum<{
          "image/jpeg": "image/jpeg";
          "image/png": "image/png";
        }>;
        data: z.ZodCustom<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>>;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** Any job the worker accepts. */
export type WorkerJob = z.infer<typeof workerJobSchema>;
/** The worker's answer to a {@link ThumbnailJob}: a WebP, or a failure without details. */
export declare const thumbnailOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"thumbnail">;
        data: z.ZodCustom<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"thumbnail-failed">;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** The worker's answer to a {@link ThumbnailJob}. */
export type ThumbnailOutcome = z.infer<typeof thumbnailOutcomeSchema>;
/** The worker's answer to a {@link CompileCssJob}. */
declare const compileCssOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"css">;
        css: z.ZodString;
        bodyClass: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"css-failed">;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** The worker's answer to a {@link CompileCssJob}. */
export type CompileCssOutcome = z.infer<typeof compileCssOutcomeSchema>;
/** The worker's answer to a {@link ClassCatalogueJob} or a {@link ClassCssJob}. */
declare const classesOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"class-catalogue">;
        classes: z.ZodArray<z.ZodString>;
        variants: z.ZodArray<z.ZodString>;
        variables: z.ZodArray<z.ZodString>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"class-css">;
        css: z.ZodArray<z.ZodNullable<z.ZodString>>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"classes-failed">;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** The worker's answer to a {@link ClassCatalogueJob} or a {@link ClassCssJob}. */
export type ClassesOutcome = z.infer<typeof classesOutcomeSchema>;
/** An item's HTML as the export writes it (3.14), or a failure: always without details. */
declare const itemHtmlOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"item-html">;
        html: z.ZodNullable<z.ZodString>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"item-html-failed">;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** The worker's answer to an {@link ItemHtmlJob}. */
export type ItemHtmlOutcome = z.infer<typeof itemHtmlOutcomeSchema>;
/**
 * Everything the canvas styles worker answers: CSS for the canvas, the class catalogue, and an
 * item's HTML for the CSS tab.
 */
export declare const canvasStylesOutcomeSchema: z.ZodUnion<
  readonly [
    z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            type: z.ZodLiteral<"css">;
            css: z.ZodString;
            bodyClass: z.ZodString;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            type: z.ZodLiteral<"css-failed">;
          },
          z.core.$strict
        >,
      ],
      "type"
    >,
    z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            type: z.ZodLiteral<"class-catalogue">;
            classes: z.ZodArray<z.ZodString>;
            variants: z.ZodArray<z.ZodString>;
            variables: z.ZodArray<z.ZodString>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            type: z.ZodLiteral<"class-css">;
            css: z.ZodArray<z.ZodNullable<z.ZodString>>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            type: z.ZodLiteral<"classes-failed">;
          },
          z.core.$strict
        >,
      ],
      "type"
    >,
    z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            type: z.ZodLiteral<"item-html">;
            html: z.ZodNullable<z.ZodString>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            type: z.ZodLiteral<"item-html-failed">;
          },
          z.core.$strict
        >,
      ],
      "type"
    >,
  ]
>;
/**
 * What the export worker reports back. Failures carry only a code: no paths, no site content
 * (standards §4, logging).
 */
export declare const exportOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"exported">;
        pages: z.ZodInt;
        files: z.ZodInt;
        bytes: z.ZodInt;
        warnings: z.ZodArray<
          z.ZodObject<
            {
              code: z.ZodEnum<{
                "broken-link": "broken-link";
                "custom-script": "custom-script";
                "form-unset": "form-unset";
                "missing-icon": "missing-icon";
                "missing-image": "missing-image";
                "missing-kept-file": "missing-kept-file";
                "not-minified": "not-minified";
                "small-icon": "small-icon";
              }>;
              page: z.ZodString;
              detail: z.ZodString;
            },
            z.core.$strict
          >
        >;
        warningCount: z.ZodInt;
        durationMs: z.ZodNumber;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"cancelled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"failed">;
        code: z.ZodEnum<{
          "build-failed": "build-failed";
          "folder-not-empty": "folder-not-empty";
          "reserved-name": "reserved-name";
          "too-large": "too-large";
          "unreadable-image": "unreadable-image";
          "write-failed": "write-failed";
        }>;
        detail: z.ZodString;
        page: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** What the export worker reports back. */
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>;
/**
 * Why a publish failed (4.5): the publisher's codes (`PUBLISH_ERROR_CODES`) but `cancelled`, which
 * is an outcome of its own, then the build's, as an export's.
 */
export declare const PUBLISH_FAILURES: readonly [
  ...(
    | "bad-key"
    | "failed"
    | "network"
    | "no-encryption"
    | "not-found"
    | "other-site"
    | "rate-limited"
    | "rejected"
    | "timeout"
    | "unauthorized"
    | "untrusted-host"
  )[],
  "build-failed",
  "reserved-name",
  "unreadable-image",
];
/**
 * What a publish job reports back (ADR 0018 §1): what went up and the live site's check, with the
 * publisher's version of it (Netlify's deploy id), for main to record; cancelled, the previous site
 * left as it was; or why it failed, by its code only (standards §4).
 */
export declare const publishOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"published">;
        url: z.ZodString;
        uploaded: z.ZodInt;
        unchanged: z.ZodInt;
        removed: z.ZodInt;
        version: z.ZodOptional<z.ZodString>;
        restored: z.ZodOptional<z.ZodLiteral<true>>;
        check: z.ZodEnum<{
          different: "different";
          live: "live";
          unchecked: "unchecked";
          unreachable: "unreachable";
        }>;
        durationMs: z.ZodNumber;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"cancelled">;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"failed">;
        code: z.ZodEnum<{
          "bad-key": "bad-key";
          "build-failed": "build-failed";
          failed: "failed";
          network: "network";
          "no-encryption": "no-encryption";
          "not-found": "not-found";
          "other-site": "other-site";
          "rate-limited": "rate-limited";
          rejected: "rejected";
          "reserved-name": "reserved-name";
          timeout: "timeout";
          unauthorized: "unauthorized";
          "unreadable-image": "unreadable-image";
          "untrusted-host": "untrusted-host";
        }>;
        detail: z.ZodString;
        page: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** What a publish job reports back. */
export type PublishOutcome = z.infer<typeof publishOutcomeSchema>;
/**
 * The preview worker's answer to a {@link PreviewJob} (3.2): the files that changed since its last
 * build and those gone, or every file (`full`) when it has none from before. A failure carries only
 * a code, as an export's does.
 */
export declare const previewOutcomeSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        type: z.ZodLiteral<"previewed">;
        full: z.ZodBoolean;
        changed: z.ZodArray<
          z.ZodObject<
            {
              path: z.ZodString;
              data: z.ZodCustom<Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>>;
            },
            z.core.$strict
          >
        >;
        removed: z.ZodArray<z.ZodString>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"preview-failed">;
        detail: z.ZodString;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** The preview worker's answer to a {@link PreviewJob}. */
export type PreviewOutcome = z.infer<typeof previewOutcomeSchema>;
//# sourceMappingURL=export-worker-protocol.d.ts.map
