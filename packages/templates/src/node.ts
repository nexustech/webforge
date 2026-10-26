import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  imageManifestSchema,
  TEMPLATE_IDS,
  type Template,
  type TemplateImage,
  templateSchema,
} from "./template.js";

/** A template as its folder holds it: the template, its images, and where their files are. */
export type TemplateFolder = {
  readonly template: Template;
  readonly images: readonly TemplateImage[];
  /** The `images/` folder the manifest's files are in. */
  readonly imagesDir: string;
  /**
   * The template's home page as a 1280×800 PNG (2.14b), which `pnpm template-thumbnails` writes
   * and CI checks is current.
   */
  readonly thumbnail: string;
};

/** This package's templates, in its `templates/` folder in the repository. */
export const TEMPLATES_DIR = join(import.meta.dirname, "..", "templates");

/**
 * Reads and checks the template `id` from `dir` (the package's `templates/`, or the copy the
 * installer ships beside app.asar): its `template.json` and `images.json`. Throws for a template
 * that is missing or doesn't pass its schemas: templates are part of the app, never a user's.
 */
export function readTemplate(id: string, dir: string = TEMPLATES_DIR): TemplateFolder {
  const folder = join(dir, id);
  const read = (file: string): unknown => JSON.parse(readFileSync(join(folder, file), "utf8"));
  const template = templateSchema.parse(read("template.json"));
  if (template.id !== id) {
    throw new Error(`The template in ${folder} says it is ${template.id}`);
  }
  return {
    template,
    images: imageManifestSchema.parse(read("images.json")),
    imagesDir: join(folder, "images"),
    thumbnail: join(folder, "thumbnail.png"),
  };
}

/** Every template the app ships ({@link TEMPLATE_IDS}), from `dir`. */
export function readTemplates(dir: string = TEMPLATES_DIR): TemplateFolder[] {
  return TEMPLATE_IDS.map((id) => readTemplate(id, dir));
}
