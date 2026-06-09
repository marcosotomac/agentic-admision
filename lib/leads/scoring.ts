import type { LeadCategory } from "@/lib/rag/types"

export const leadFieldKeys = [
  "name",
  "lastName",
  "program",
  "faculty",
  "currentStatus",
  "age",
  "originInstitution",
  "school",
  "graduationYear",
  "currentUniversity",
  "city",
  "country",
  "modality",
  "campus",
  "email",
  "phone",
  "schedule",
  "budget",
  "urgency",
  "objections",
  "interestLevel",
] as const

const qualificationFieldKeys = [
  "name",
  "program",
  "currentStatus",
  "age",
  "originInstitution",
  "city",
  "modality",
  "campus",
  "email",
  "phone",
  "schedule",
] as const satisfies readonly LeadFieldKey[]

export type LeadFieldKey = (typeof leadFieldKeys)[number]

export type LeadFields = Partial<Record<LeadFieldKey, string>>

export type LeadCapture = {
  fields: LeadFields
  commercialIntent: boolean
  urgencyIntent: boolean
  requestedHumanContact: boolean
  informationalOnly: boolean
  intentSignals: string[]
}

export type LeadScore = {
  score: number
  category: LeadCategory
  missingFields: LeadFieldKey[]
  nextAction?: string
  shouldCreateOrUpdateLead: boolean
}

export function scoreLeadCapture(capture: LeadCapture): LeadScore {
  const hasFields = hasMeaningfulLeadFields(capture.fields)
  const shouldCreateOrUpdateLead = capture.commercialIntent || hasFields
  let score = 0

  if (capture.fields.email) {
    score += 25
  }

  if (capture.fields.phone) {
    score += 25
  }

  if (capture.fields.program || capture.fields.faculty) {
    score += 20
  }

  if (capture.fields.modality || capture.fields.campus) {
    score += 10
  }

  if (
    capture.fields.age ||
    capture.fields.originInstitution ||
    capture.fields.school ||
    capture.fields.currentUniversity ||
    capture.fields.graduationYear ||
    capture.fields.currentStatus
  ) {
    score += 10
  }

  if (capture.fields.city || capture.fields.country) {
    score += 5
  }

  if (capture.fields.budget || capture.fields.objections) {
    score += 5
  }

  if (capture.fields.urgency || capture.fields.interestLevel === "High") {
    score += 10
  }

  if (capture.urgencyIntent) {
    score += 20
  }

  if (capture.requestedHumanContact) {
    score += 30
  }

  if (capture.informationalOnly && !shouldCreateOrUpdateLead) {
    score += 10
  }

  score = Math.min(score, 100)

  const category = categorizeLead(score)
  const missingFields = shouldCreateOrUpdateLead
    ? getMissingFields(capture.fields)
    : []

  return {
    score,
    category,
    missingFields,
    nextAction: getNextAction({
      category,
      missingFields,
      shouldCreateOrUpdateLead,
    }),
    shouldCreateOrUpdateLead,
  }
}

export function hasMeaningfulLeadFields(fields: LeadFields) {
  return leadFieldKeys.some((field) => Boolean(fields[field]?.trim()))
}

function categorizeLead(score: number): LeadCategory {
  if (score >= 70) {
    return "hot"
  }

  if (score >= 40) {
    return "warm"
  }

  return "cold"
}

function getMissingFields(fields: LeadFields): LeadFieldKey[] {
  return qualificationFieldKeys.filter((field) => !fields[field]?.trim())
}

function getNextAction(params: {
  category: LeadCategory
  missingFields: LeadFieldKey[]
  shouldCreateOrUpdateLead: boolean
}) {
  if (!params.shouldCreateOrUpdateLead) {
    return undefined
  }

  if (params.category === "hot") {
    return "Prioritize human admissions follow-up for this lead."
  }

  const highestValueMissingField = params.missingFields[0]

  switch (highestValueMissingField) {
    case "email":
      return "Ask for an email address to continue admissions follow-up."
    case "phone":
      return "Ask for a phone number to coordinate admissions follow-up."
    case "program":
      return "Ask which program or career the student is interested in."
    case "age":
      return "Ask for the student's age or school stage."
    case "originInstitution":
      return "Ask for the student's school, institute, or university of origin."
    case "currentStatus":
      return "Ask whether the student is in school, graduated, or transferring."
    case "city":
      return "Ask which city the student is applying from."
    case "modality":
      return "Ask which study or admission modality the student prefers."
    case "campus":
      return "Ask which campus the student prefers."
    case "schedule":
      return "Ask for the preferred schedule, modality, or start timing."
    case "name":
      return "Ask for the student's name to personalize admissions follow-up."
    default:
      return "Continue qualifying the lead with one natural admissions question."
  }
}
