import type { FixIntakeQuestionId, FixRunIntake } from "@repo/types/fix"

export type IntakeOption = {
  id: string
  label: string
  description: string
}

export type IntakeQuestion = {
  id: FixIntakeQuestionId
  question: string
  notePlaceholder: string
  options: IntakeOption[]
}

export type IntakeAnswers = Record<FixIntakeQuestionId, string>
export type IntakeNotes = Partial<Record<FixIntakeQuestionId, string>>

export const intakeQuestions: IntakeQuestion[] = [
  {
    id: "visible_copy",
    question: "How much visible page copy can the agent adjust?",
    notePlaceholder: "Any sections or phrases to preserve?",
    options: [
      {
        id: "tighten_existing",
        label: "Tighten existing copy",
        description: "Small clarity edits to content already on the site.",
      },
      {
        id: "structural_only",
        label: "Structural only",
        description: "Metadata, schema, links, labels, and crawler fixes only.",
      },
      {
        id: "new_sections_allowed",
        label: "New sections allowed",
        description:
          "Short FAQ or definition blocks when your notes support it.",
      },
    ],
  },
  {
    id: "new_content",
    question: "What net-new content is allowed?",
    notePlaceholder: "Add FAQ questions and canonical answers here if allowed.",
    options: [
      {
        id: "none",
        label: "No new content",
        description: "Use only existing website copy.",
      },
      {
        id: "faq_from_notes",
        label: "FAQ from notes",
        description: "Add FAQ answers only from details you provide.",
      },
      {
        id: "definitions_and_faq",
        label: "Definitions and FAQ",
        description:
          "Add concise answer-first blocks from your provided facts.",
      },
    ],
  },
  {
    id: "claims",
    question: "What factual claims can it add?",
    notePlaceholder: "List approved facts, stats, pricing, or claims to avoid.",
    options: [
      {
        id: "no_new_claims",
        label: "No new claims",
        description: "Do not add facts that are not already on the site.",
      },
      {
        id: "provided_facts_only",
        label: "Provided facts only",
        description: "Use only facts you write in the notes.",
      },
      {
        id: "flag_uncertain",
        label: "Flag uncertain items",
        description: "Skip edits when facts are unclear.",
      },
    ],
  },
  {
    id: "visual_changes",
    question: "How much layout or design change is okay?",
    notePlaceholder:
      "Mention pages, components, or layouts that are off-limits.",
    options: [
      {
        id: "keep_layout",
        label: "Keep layout",
        description:
          "No visual restructuring unless required for accessibility.",
      },
      {
        id: "minor_polish",
        label: "Minor polish",
        description: "Small spacing, label, and semantic markup adjustments.",
      },
      {
        id: "simple_blocks",
        label: "Simple blocks",
        description: "Add compact content blocks when needed.",
      },
    ],
  },
  {
    id: "review_preference",
    question: "What should the agent prioritize when tradeoffs come up?",
    notePlaceholder: "Anything the PR should explicitly call out?",
    options: [
      {
        id: "small_safe_pr",
        label: "Small safe PR",
        description: "Prefer fewer, lower-risk changes.",
      },
      {
        id: "score_lift",
        label: "Score lift",
        description: "Prioritize the largest readiness improvements.",
      },
      {
        id: "flag_more",
        label: "Flag more",
        description: "Skip uncertain edits and explain why.",
      },
    ],
  },
]

export const defaultIntakeAnswers: IntakeAnswers = {
  visible_copy: "tighten_existing",
  new_content: "none",
  claims: "no_new_claims",
  visual_changes: "keep_layout",
  review_preference: "small_safe_pr",
}

export function findOption(question: IntakeQuestion, answerId: string) {
  return (
    question.options.find((option) => option.id === answerId) ??
    question.options[0]
  )
}

export function buildIntake(
  answers: IntakeAnswers,
  notes: IntakeNotes
): FixRunIntake {
  return {
    version: 1,
    submittedAt: new Date().toISOString(),
    answers: intakeQuestions.map((question) => {
      const option = findOption(question, answers[question.id])

      return {
        questionId: question.id,
        question: question.question,
        answerId: option.id,
        answerLabel: option.label,
        notes: notes[question.id]?.trim() || null,
      }
    }),
  }
}
