import { ReactNode } from "react"
import type { ChatApiResponse, RagSource, IconName, Category } from "@/lib/types/chat"
import type { LeadFields } from "@/lib/leads/scoring"
import { careersByCategory } from "@/lib/constants/careers"

export const KEY_FIELDS = [
  "name",
  "email",
  "phone",
  "program",
  "modality",
  "city",
] as const

export const PENDING_STATUS_STEPS = [
  "Consultando mallas académicas oficiales...",
  "Analizando costos y pensiones de USIL...",
  "Validando becas e incentivos comerciales...",
  "Redactando respuesta de admisión...",
]

export const hoverToneClasses: Record<Category["tone"], string> = {
  blue: "group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:ring-blue-100",
  green:
    "group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:ring-emerald-100",
  violet:
    "group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:ring-indigo-100",
  orange:
    "group-hover:bg-orange-50 group-hover:text-orange-500 group-hover:ring-orange-100",
  pink: "group-hover:bg-fuchsia-50 group-hover:text-fuchsia-500 group-hover:ring-fuchsia-100",
}

export function formatMessageTime() {
  return new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date())
}

export function createSessionId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

export function createMessageId() {
  return `msg-${createSessionId()}`
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isRagSource(value: unknown): value is RagSource {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.title === "string" &&
    typeof value.url === "string" &&
    typeof value.chunkId === "string" &&
    typeof value.score === "number"
  )
}

export function isChatApiResponse(value: unknown): value is ChatApiResponse {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.answer === "string" &&
    Array.isArray(value.sources) &&
    value.sources.every(isRagSource) &&
    (value.cache === "hit" || value.cache === "miss")
  )
}

export function getResponseError(value: unknown) {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error
  }

  return "No pude completar la consulta en este momento. Intentá nuevamente."
}

export function countFilledFields(fields: LeadFields): number {
  let count = 0
  for (const key of KEY_FIELDS) {
    if (fields[key] && fields[key].trim().length > 0) {
      count++
    }
  }
  return count
}

export function detectCurriculumCareer(
  text: string,
  currentProgram?: string
): string | null {
  const hasMallaKeyword =
    /\b(malla|plan de estudios|malla curricular|cursos por ciclo|ciclos)\b/i.test(
      text
    )
  if (!hasMallaKeyword) return null

  if (
    currentProgram &&
    text.toLowerCase().includes(currentProgram.toLowerCase())
  ) {
    return currentProgram
  }

  for (const category in careersByCategory) {
    for (const career of careersByCategory[category]) {
      if (text.toLowerCase().includes(career.toLowerCase())) {
        return career
      }
    }
  }

  return currentProgram || null
}
