import type { LeadFields } from "@/lib/leads/scoring"

export const EMBEDDING_DIMENSIONS = 1536

export const CACHE_MATCH_THRESHOLD = 0.9
export const KNOWLEDGE_MATCH_THRESHOLD = 0.68
export const KNOWLEDGE_MATCH_COUNT = 8

export type RagSource = {
  title: string
  url: string
  chunkId: string
  score: number
}

export type ChatCacheState = "hit" | "miss"

export type LeadCategory = "hot" | "warm" | "cold"

export type LeadState = {
  id?: string
  score: number
  category: LeadCategory
  missingFields: string[]
}

export type ChatResponse = {
  answer: string
  sources: RagSource[]
  lead: LeadState
  nextAction?: string
  cache: ChatCacheState
  diagnostics?: ChatDiagnostics
  profileFields?: LeadFields
}

export type ChatDiagnostics = {
  totalMs: number
  timingsMs: Record<string, number>
  knowledgeMatchCount?: number
  initialKnowledgeMatchCount?: number
  sourceCount: number
  webSearchAttempted?: boolean
  webSearchStatus?: WebSearchFallbackStatus
  webSearchError?: string
}

export type WebSearchFallbackStatus =
  | "not_applicable"
  | "answered"
  | "no_citations"
  | "failed"

export type SemanticCacheEntry = {
  id: string
  question: string
  answer: string
  sources: RagSource[]
  score: number
}

export type KnowledgeChunk = {
  id: string
  sourceId: string
  sourceUrl: string
  sourceTitle: string
  content: string
  metadata: Record<string, unknown>
  score: number
}

export type GroundedAnswer = {
  answer: string
  sources: RagSource[]
}

export type WebSearchFallbackAnswer = GroundedAnswer & {
  status: WebSearchFallbackStatus
  error?: string
}
