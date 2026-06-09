import type { SupabaseClient } from "@supabase/supabase-js"

import { createQuestionChecksum, toVectorLiteral } from "./embeddings"
import {
  CACHE_MATCH_THRESHOLD,
  type RagSource,
  type SemanticCacheEntry,
} from "./types"

type SemanticCacheRpcRow = {
  id: string
  question: string
  answer: string
  sources: unknown
  similarity: number
}

export async function findSemanticCacheEntry(
  supabase: SupabaseClient,
  embedding: number[]
): Promise<SemanticCacheEntry | null> {
  const { data, error } = await supabase.rpc("match_semantic_cache", {
    query_embedding: toVectorLiteral(embedding),
    match_threshold: CACHE_MATCH_THRESHOLD,
    match_count: 1,
  })

  if (error) {
    throw new Error(`Semantic cache lookup failed: ${error.message}`)
  }

  const row = firstRow<SemanticCacheRpcRow>(data)

  if (!row) {
    return null
  }

  touchSemanticCacheEntry(supabase, row.id)

  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sources: parseSources(row.sources),
    score: row.similarity,
  }
}

export async function findExactSemanticCacheEntry(
  supabase: SupabaseClient,
  normalizedQuestion: string
): Promise<SemanticCacheEntry | null> {
  const { data, error } = await supabase
    .from("semantic_cache")
    .select("id, question, answer, sources")
    .eq("question_checksum", createQuestionChecksum(normalizedQuestion))
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Exact semantic cache lookup failed: ${error.message}`)
  }

  if (!data) {
    return null
  }

  touchSemanticCacheEntry(supabase, data.id)

  return {
    id: data.id,
    question: data.question,
    answer: data.answer,
    sources: parseSources(data.sources),
    score: 1,
  }
}

export async function writeSemanticCacheEntry(params: {
  supabase: SupabaseClient
  question: string
  normalizedQuestion: string
  answer: string
  embedding: number[]
  sources: RagSource[]
}) {
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 30
  ).toISOString()

  const { error } = await params.supabase.from("semantic_cache").upsert(
    {
      question: params.question,
      normalized_question: params.normalizedQuestion,
      question_checksum: createQuestionChecksum(params.normalizedQuestion),
      answer: params.answer,
      embedding: toVectorLiteral(params.embedding),
      sources: params.sources,
      expires_at: expiresAt,
      metadata: {
        source: "api_chat",
      },
    },
    { onConflict: "question_checksum" }
  )

  if (error) {
    throw new Error(`Semantic cache write failed: ${error.message}`)
  }
}

function firstRow<T>(data: unknown): T | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  return data[0] as T
}

function touchSemanticCacheEntry(supabase: SupabaseClient, id: string) {
  void supabase
    .from("semantic_cache")
    .update({ last_hit_at: new Date().toISOString() })
    .eq("id", id)
    .then(({ error }) => {
      if (error) {
        console.error("Semantic cache touch failed", error)
      }
    })
}

function parseSources(value: unknown): RagSource[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((source) => {
    if (!isRecord(source)) {
      return []
    }

    const title = stringValue(source.title)
    const url = stringValue(source.url)
    const chunkId = stringValue(source.chunkId)
    const score = numberValue(source.score)

    if (!title || !url || !chunkId || score === null) {
      return []
    }

    return [{ title, url, chunkId, score }]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
