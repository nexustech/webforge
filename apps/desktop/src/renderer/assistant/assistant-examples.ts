import { isMessageKey, t } from "@webforge/i18n";

/**
 * *Things You Can Ask* (5.21, OL-8): example requests for the assistant, by topic, each one its
 * tools can carry out today (ADR 0026): words through `editText`, images already in Media through
 * `updateFields`, sections through `addNode` and `moveNode`, pages through the page commands, the
 * theme through `setThemeTokens`, and search engines through `updatePageSettings`. Each example's
 * words are `assistant.example.<topic>.<id>` in the catalogue, and each topic's name
 * `assistant.examples.topic.<topic>`, so adding one is a line here and a line there.
 */
export const ASSISTANT_EXAMPLES = {
  words: ["selected", "warmer", "spelling"],
  images: ["describe", "place"],
  sections: ["hours", "questions", "move"],
  pages: ["add", "rename", "order"],
  theme: ["warmer", "font", "corners"],
  search: ["descriptions", "title", "hide"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** A topic of {@link ASSISTANT_EXAMPLES}. */
export type ExampleTopic = keyof typeof ASSISTANT_EXAMPLES;

/** The catalogue key of a topic's name. */
export const topicKey = (topic: ExampleTopic) => `assistant.examples.topic.${topic}`;

/** The catalogue key of an example's words. */
export const exampleKey = (topic: ExampleTopic, id: string) => `assistant.example.${topic}.${id}`;

/** A topic as the list shows it: its name, and its examples' words. */
export type ShownTopic = {
  readonly topic: ExampleTopic;
  readonly title: string;
  readonly examples: readonly { readonly id: string; readonly text: string }[];
};

/** The words of a catalogue key built from data: none for a key the catalogue doesn't have. */
const words = (key: string) => (isMessageKey(key) ? t(key) : undefined);

/**
 * The topics and their examples whose words, or whose topic's name, hold `query` (any case);
 * every one for an empty query. A topic with none that match is left out.
 */
export function examplesFor(query: string): readonly ShownTopic[] {
  const wanted = query.trim().toLowerCase();
  const holds = (text: string) => wanted === "" || text.toLowerCase().includes(wanted);
  return (Object.keys(ASSISTANT_EXAMPLES) as ExampleTopic[]).flatMap((topic) => {
    const title = words(topicKey(topic));
    if (title === undefined) return [];
    const examples = ASSISTANT_EXAMPLES[topic].flatMap((id) => {
      const text = words(exampleKey(topic, id));
      return text === undefined ? [] : [{ id, text }];
    });
    const shown = holds(title) ? examples : examples.filter((each) => holds(each.text));
    return shown.length === 0 ? [] : [{ topic, title, examples: shown }];
  });
}
