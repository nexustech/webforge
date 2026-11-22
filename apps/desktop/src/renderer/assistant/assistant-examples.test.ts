import { isMessageKey } from "@webforge/i18n";
import { describe, expect, it } from "vitest";
import {
  ASSISTANT_EXAMPLES,
  type ExampleTopic,
  exampleKey,
  examplesFor,
  topicKey,
} from "./assistant-examples.js";

const topics = Object.keys(ASSISTANT_EXAMPLES) as ExampleTopic[];

describe("Things You Can Ask's examples (5.21, OL-8)", () => {
  it("has words in the catalogue for every topic and every example", () => {
    const missing = topics.flatMap((topic) => [
      ...(isMessageKey(topicKey(topic)) ? [] : [topicKey(topic)]),
      ...ASSISTANT_EXAMPLES[topic]
        .map((id) => exampleKey(topic, id))
        .filter((key) => !isMessageKey(key)),
    ]);

    expect(missing).toEqual([]);
  });

  it("covers words, images, sections, pages, the theme and search engines", () => {
    expect(examplesFor("").map((shown) => shown.title)).toEqual([
      "Words",
      "Images",
      "Sections",
      "Pages",
      "Theme",
      "Search engines",
    ]);
    for (const shown of examplesFor("")) expect(shown.examples.length).toBeGreaterThan(1);
  });

  it("narrows to the examples whose words hold the search, in any case", () => {
    const found = examplesFor("  CONTACT ");

    expect(found.map((shown) => shown.topic)).toEqual(["sections", "pages"]);
    expect(found.flatMap((shown) => shown.examples.map((each) => each.text))).toEqual([
      "Add a section with our opening hours to the Contact page.",
      "Move the contact form above the map.",
      "Move the Contact page to the end of the menu.",
    ]);
  });

  it("keeps a whole topic whose name holds the search, and finds nothing for words in none", () => {
    expect(examplesFor("theme")[0]?.examples).toHaveLength(ASSISTANT_EXAMPLES.theme.length);
    expect(examplesFor("zebra")).toEqual([]);
  });
});
