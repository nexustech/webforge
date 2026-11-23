import { z } from "zod";
import {
  ANSWER_MAX_CHARS,
  QUESTION_ANSWERS_MAX,
  QUESTION_MAX_CHARS,
  QUESTIONS_MAX,
  type ReplyQuestion,
} from "../../shared/ipc/assistant.js";
import type { ChatTool } from "./chat-client.js";

/**
 * The assistant's question to the person (5.16, OL-1): a tool of the loop's own, never the site's,
 * with which the model asks one short question when a request is too vague to act on well. The
 * reply waits for the answer, which goes back to the model as the tool's result.
 */

/** The tool's name: no tool of 4.9's layer has it. */
export const ASK_TOOL = "askPerson";

/** The longest topic a question names. */
const TOPIC_MAX = 60;

/** The tool as the model is offered it. */
export const ASK_TOOL_DEFINITION: ChatTool = {
  type: "function",
  function: {
    name: ASK_TOOL,
    description: [
      "Asks the person one short question and waits for their answer, when their request is too",
      "vague to act on well. Offer up to four short answers, the one you recommend first; the",
      "person can choose one or write their own, and may add a note. Ask once per topic, never for",
      "something you can read from the site, and never to ask permission for a change: the person",
      "reviews every change already.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          maxLength: TOPIC_MAX,
          description: "What it's about, in a few words, such as 'colours' or 'tone of the text'.",
        },
        question: { type: "string", maxLength: QUESTION_MAX_CHARS },
        answers: {
          type: "array",
          items: { type: "string", maxLength: ANSWER_MAX_CHARS },
          minItems: 1,
          maxItems: QUESTION_ANSWERS_MAX,
          description: "Up to four answers to choose from, the one you recommend first.",
        },
      },
      required: ["topic", "question", "answers"],
      additionalProperties: false,
    },
  },
};

const askSchema = z.strictObject({
  topic: z.string().trim().min(1).max(TOPIC_MAX),
  question: z.string().trim().min(1).max(QUESTION_MAX_CHARS),
  answers: z.array(z.string().trim().min(1).max(ANSWER_MAX_CHARS)).min(1).max(QUESTION_ANSWERS_MAX),
});

/** A topic as compared: its words, lower-case, whatever their spacing or punctuation. */
const topicKey = (topic: string) =>
  topic
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "")
    .join(" ");

/** What becomes of a question the model asks: put to the person, or its answer to the model. */
type Asked =
  | { readonly status: "ask"; readonly question: Omit<ReplyQuestion, "callId"> }
  | { readonly status: "invalid" | "refused"; readonly text: string };

/** The tool's answer to the model when it can't ask. */
const answer = (status: "invalid" | "refused", message: string): Asked => ({
  status,
  text: JSON.stringify({ status, message }),
});

/**
 * One reply's questions: each topic asked once (OL-1), and {@link QUESTIONS_MAX} in all. `check`
 * reads a call's arguments, and counts the question it gives the person.
 */
export function createAsking() {
  const topics = new Set<string>();
  return {
    check(argumentText: string): Asked {
      let parsed: unknown;
      try {
        parsed = argumentText.trim() === "" ? {} : JSON.parse(argumentText);
      } catch {
        parsed = undefined;
      }
      const checked = askSchema.safeParse(parsed);
      if (!checked.success) {
        return answer(
          "invalid",
          `Give a topic, a question of up to ${QUESTION_MAX_CHARS} characters, and 1 to ${QUESTION_ANSWERS_MAX} answers.`,
        );
      }
      const { topic, question, answers } = checked.data;
      const key = topicKey(topic);
      if (topics.has(key)) {
        return answer(
          "refused",
          "You've asked about this already in this reply. Go on with what the person said.",
        );
      }
      if (topics.size >= QUESTIONS_MAX) {
        return answer(
          "refused",
          "You've asked enough questions in this reply. Go on with what the person said.",
        );
      }
      topics.add(key);
      return { status: "ask", question: { question, answers } };
    },
  };
}
