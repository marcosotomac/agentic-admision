import type { SupabaseClient } from "@supabase/supabase-js"

import { hasMeaningfulLeadFields, type LeadCapture } from "@/lib/leads/scoring"

const RECENT_MESSAGE_LIMIT = 8

type MessageRole = "user" | "assistant" | "system" | "tool"

export type RecentConversationMessage = {
  role: MessageRole
  content: string
}

type MessageRow = {
  role: MessageRole
  content: string
  created_at: string
}

export async function fetchRecentConversationMessages(params: {
  supabase: SupabaseClient
  sessionId: string
  limit?: number
}): Promise<RecentConversationMessage[]> {
  try {
    const { data, error } = await params.supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("session_id", params.sessionId)
      .order("created_at", { ascending: false })
      .limit(params.limit ?? RECENT_MESSAGE_LIMIT)

    if (error) {
      console.error("Recent conversation lookup failed", error)
      return []
    }

    return ((data as MessageRow[] | null) ?? [])
      .slice()
      .reverse()
      .map((message) => ({
        role: message.role,
        content: message.content,
      }))
  } catch (error) {
    console.error("Recent conversation lookup failed", error)
    return []
  }
}

export function shouldBypassCacheForConversation(message: string) {
  return (
    isGreeting(message) ||
    isEnrollmentIntent(message) ||
    isPersonalContextTurn(message) ||
    isContextualFollowUp(message) ||
    isInstitutionalUsilQuestion(message)
  )
}

export function shouldUseAdmissionsAdvisorReply(params: {
  message: string
  history: RecentConversationMessage[]
  capture: LeadCapture
}) {
  if (hasMeaningfulLeadFields(params.capture.fields)) {
    return true
  }

  if (isGreeting(params.message) || isEnrollmentIntent(params.message)) {
    return true
  }

  if (isPersonalContextTurn(params.message)) {
    return true
  }

  if (isModalityAdviceFollowUp(params.message, params.history)) {
    return true
  }

  return (
    params.capture.commercialIntent &&
    !isKnowledgeSeekingQuestion(params.message)
  )
}

export function buildContextualQuestion(params: {
  message: string
  history: RecentConversationMessage[]
}) {
  const normalizedMessage = normalizeForIntent(params.message)
  const topic = inferRecentTopic(params.history)

  if (!topic || !isContextualFollowUp(normalizedMessage)) {
    return params.message
  }

  return `${params.message}\nContexto reciente de la conversación: ${topic}.`
}

export function isInstitutionalUsilQuestion(message: string) {
  const normalizedMessage = normalizeForIntent(message)

  return (
    hasAny(normalizedMessage, ["usil", "universidad", "san ignacio", "la u"]) &&
    hasAny(normalizedMessage, [
      "fundacion",
      "fundada",
      "creacion",
      "creada",
      "creo",
      "historia",
      "edad",
      "anos",
      "antiguedad",
    ])
  )
}

export function isPersonalContextTurn(message: string) {
  const normalizedMessage = normalizeForIntent(message)

  return hasAny(normalizedMessage, [
    "ya te dije",
    "te dije",
    "ya lo dije",
    "ya te lo dije",
    "no me preguntes de nuevo",
    "no me preguntes otra vez",
    "me estas preguntando otra vez",
    "me preguntaste de nuevo",
    "mi nombre",
    "mi apellido",
    "mi colegio",
    "mi edad",
    "como me llamo",
    "recuerdas mi nombre",
    "recordas mi nombre",
    "que sabes de mi",
  ])
}

function isGreeting(message: string) {
  const normalizedMessage = normalizeForIntent(message)

  return /^(hola|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hello|hi)$/.test(
    normalizedMessage
  )
}

function isEnrollmentIntent(message: string) {
  const normalizedMessage = normalizeForIntent(message)

  return hasAny(normalizedMessage, [
    "quiero inscribirme",
    "inscribirme",
    "inscripcion",
    "como me inscribo",
    "donde me inscribo",
    "donde hacerlo",
    "como empiezo",
    "quiero postular",
    "postular",
    "postulacion",
    "matricularme",
    "matricula",
  ])
}

function isKnowledgeSeekingQuestion(message: string) {
  const normalizedMessage = normalizeForIntent(message)

  return hasAny(normalizedMessage, [
    "modalidad",
    "modalidades",
    "carrera",
    "carreras",
    "programa",
    "programas",
    "malla",
    "plan de estudios",
    "beca",
    "becas",
    "financiamiento",
    "pension",
    "pensiones",
    "costo",
    "costos",
    "campus",
    "requisito",
    "requisitos",
    "fecha",
    "fechas",
  ])
}

function isContextualFollowUp(message: string) {
  const normalizedMessage = normalizeForIntent(message)

  return hasAny(normalizedMessage, [
    "tambien",
    "y tambien",
    "y eso",
    "eso",
    "cual me conviene",
    "cual conviene",
    "cual seria mejor",
    "que me recomiendas",
    "que me recomendas",
  ])
}

function isModalityAdviceFollowUp(
  message: string,
  history: RecentConversationMessage[]
) {
  const normalizedMessage = normalizeForIntent(message)

  return (
    hasAny(normalizedMessage, [
      "cual me conviene",
      "cual conviene",
      "cual seria mejor",
      "que me recomiendas",
      "que me recomendas",
    ]) && inferRecentTopic(history) === "modalidades de admisión USIL"
  )
}

function inferRecentTopic(history: RecentConversationMessage[]) {
  const recentText = normalizeForIntent(
    history
      .slice(-RECENT_MESSAGE_LIMIT)
      .map((message) => message.content)
      .join(" ")
  )

  if (
    hasAny(recentText, ["modalidad", "modalidades", "admision", "postulacion"])
  ) {
    return "modalidades de admisión USIL"
  }

  if (
    hasAny(recentText, [
      "carrera",
      "carreras",
      "programa",
      "programas",
      "pregrado",
    ])
  ) {
    return "carreras y programas de pregrado USIL"
  }

  if (
    hasAny(recentText, [
      "beca",
      "becas",
      "financiamiento",
      "costos",
      "pensiones",
    ])
  ) {
    return "costos, becas y financiamiento USIL"
  }

  if (hasAny(recentText, ["fundacion", "historia", "creada", "edad"])) {
    return "historia institucional de USIL"
  }

  return null
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

function normalizeForIntent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
