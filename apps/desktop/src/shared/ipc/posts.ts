import { z } from "zod";

/** The most files one *Import Posts…* takes (6.10b). */
export const POST_FILES_MAX = 200;

/** The largest file it reads: a long post as Markdown, or a CSV of a few hundred. */
export const POST_FILE_BYTES_MAX = 1024 * 1024;

/** A file chosen to import posts from: its name (for the person, and its kind) and its text. */
const postFileSchema = z.strictObject({
  name: z.string().min(1).max(260),
  text: z.string().max(POST_FILE_BYTES_MAX),
});

/** See {@link postFileSchema}. */
export type PostFile = z.infer<typeof postFileSchema>;

/**
 * What choosing files to import gave: their text, nothing (the dialog cancelled), or why nothing
 * was read: too many files, or one too large.
 */
const chosenSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("chosen"),
    files: z.array(postFileSchema).max(POST_FILES_MAX),
  }),
  z.strictObject({ status: z.literal("cancelled") }),
  z.strictObject({ status: z.literal("tooLarge"), name: z.string().max(260) }),
  z.strictObject({ status: z.literal("tooMany") }),
]);

/** See {@link chosenSchema}. */
export type ChosenPostFiles = z.infer<typeof chosenSchema>;

/** IPC channels of the `posts` domain (`posts:*`, 6.10b). Each one's arguments are checked. */
export const postsChannels = {
  /**
   * *Import Posts…*: the person chooses Markdown or CSV files in the system's dialog, and main
   * reads them as text. Nothing else on the computer is read, and nothing is fetched.
   */
  postsChooseFiles: {
    channel: "posts:choose-files",
    request: z.tuple([]),
    response: chosenSchema,
  },
} as const;

/** `window.webforge.posts`. */
export interface PostsApi {
  /** Shows the dialog to choose files to import posts from, and gives their text. */
  chooseFiles(): Promise<ChosenPostFiles>;
}
