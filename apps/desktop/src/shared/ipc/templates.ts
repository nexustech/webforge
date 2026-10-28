import { PAGE_TITLE_MAX } from "@webforge/model";
import { TEMPLATE_CATEGORIES, TEMPLATE_IDS } from "@webforge/templates";
import { z } from "zod";

/**
 * A template as the New Site dialog lists it (2.14a): its id (its name and description are
 * `t("template.<id>.name")` and `.description`), its business type, whether *Try an example*
 * offers it, how many pages it has, and the theme preset it starts in.
 */
const templateSummarySchema = z.strictObject({
  id: z.enum(TEMPLATE_IDS),
  category: z.enum(TEMPLATE_CATEGORIES),
  example: z.boolean(),
  pages: z.int().min(1).max(100),
  /**
   * Its pages as the quick start's Pages step lists them (QS-1, 3.11b), in the Pages panel's
   * order: each page's id and title, and whether it is the home page, which can't be left out.
   * "Page not found" isn't listed: every site has one.
   */
  pageList: z
    .array(
      z.strictObject({
        id: z.string().max(100),
        title: z.string().max(PAGE_TITLE_MAX),
        home: z.boolean(),
      }),
    )
    .max(100),
  theme: z.string().max(40),
  /** Its home page as a PNG data URL (2.14b); `null` for a template without one. */
  thumbnail: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
});

/** See {@link templateSummarySchema}. */
export type TemplateSummary = z.infer<typeof templateSummarySchema>;

/** IPC channels of the `templates` domain (`templates:*`). Each one's arguments are checked. */
export const templatesChannels = {
  /** The templates the app ships, in the order New Site shows them. */
  listTemplates: {
    channel: "templates:list",
    request: z.tuple([]),
    response: z.array(templateSummarySchema).max(100),
  },
} as const;

/** `window.webforge.templates`. */
export interface TemplatesApi {
  /** The templates the app ships (2.14a), for the New Site dialog. */
  list(): Promise<TemplateSummary[]>;
}
