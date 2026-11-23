import type { Meta, StoryObj } from "@storybook/react-vite";
import type { QuestionAnswer } from "../../shared/ipc/assistant.js";
import { QuestionCard } from "./QuestionCard.js";

// A question the assistant asks before acting on a vague request (5.16, OL-1), at a side panel's
// width.
const meta = { title: "Assistant/Question" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const QUESTION = "What should “more professional” mean for your bakery's site?";

const ANSWERS = [
  "Calmer colours and more space",
  "A more formal tone in the text",
  "Both of those",
  "Bigger photos of the bakes",
];

/** The card waiting, sending an answer, answered, or left unanswered. */
const card = (options: { waiting?: boolean; busy?: boolean; answer?: QuestionAnswer }): Story => ({
  render: () => (
    <div className="w-80 rounded-md border border-border bg-panel p-3">
      <QuestionCard
        question={QUESTION}
        answers={ANSWERS}
        answer={options.answer}
        waiting={options.waiting === true}
        busy={options.busy === true}
        onAnswer={() => undefined}
      />
    </div>
  ),
});

/** The reply waits: the answers, the recommended one first, and a note. */
export const Waiting: Story = card({ waiting: true });

/** An answer on its way: the answers wait. */
export const Answering: Story = card({ waiting: true, busy: true });

/** Answered, with a note: the reply went on. */
export const Answered: Story = card({
  answer: { answer: "Calmer colours and more space", note: "Keep our logo as it is." },
});

/** Stop ended the reply before an answer. */
export const Unanswered: Story = card({});
