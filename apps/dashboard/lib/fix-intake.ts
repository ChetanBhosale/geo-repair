import type {
  FixClarificationQuestion,
  FixClarificationRequest,
  FixRunDetail,
  FixRunIntake,
} from "@repo/types/fix"

export type IntakeAnswers = Record<string, string>
export type IntakeNotes = Record<string, string>

export function defaultAnswersForQuestions(
  questions: FixClarificationQuestion[]
): IntakeAnswers {
  return Object.fromEntries(
    questions.map((question) => [question.id, question.options[0]?.id ?? ""])
  )
}

export function buildIntake(
  request: FixClarificationRequest,
  answers: IntakeAnswers,
  notes: IntakeNotes
): FixRunIntake {
  return {
    version: 1,
    submittedAt: new Date().toISOString(),
    answers: request.questions.map((question) => {
      const option =
        question.options.find((item) => item.id === answers[question.id]) ??
        question.options[0]

      return {
        questionId: question.id,
        question: question.question,
        answerId: option?.id ?? "",
        answerLabel: option?.label ?? "",
        notes: notes[question.id]?.trim() || null,
      }
    }),
  }
}

export function latestClarificationRequest(
  detail: FixRunDetail | null
): FixClarificationRequest | null {
  const event = detail?.events
    .slice()
    .reverse()
    .find((item) => item.type === "agent_clarification_requested")

  return event && isClarificationRequest(event.payload) ? event.payload : null
}

function isClarificationRequest(
  value: unknown
): value is FixClarificationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<FixClarificationRequest>
  return (
    candidate.version === 1 &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.questions) &&
    candidate.questions.every(isClarificationQuestion)
  )
}

function isClarificationQuestion(
  value: unknown
): value is FixClarificationQuestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<FixClarificationQuestion>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.question === "string" &&
    typeof candidate.notePlaceholder === "string" &&
    Array.isArray(candidate.options) &&
    candidate.options.every(
      (option) =>
        !!option &&
        typeof option === "object" &&
        !Array.isArray(option) &&
        typeof (option as { id?: unknown }).id === "string" &&
        typeof (option as { label?: unknown }).label === "string" &&
        typeof (option as { description?: unknown }).description === "string"
    )
  )
}
