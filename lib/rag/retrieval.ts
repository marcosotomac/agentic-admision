import type { SupabaseClient } from "@supabase/supabase-js"

import { toVectorLiteral } from "./embeddings"
import {
  KNOWLEDGE_MATCH_COUNT,
  KNOWLEDGE_MATCH_THRESHOLD,
  type KnowledgeChunk,
  type RagSource,
} from "./types"

type KnowledgeRpcRow = {
  id: string
  source_id: string
  source_url: string
  source_title: string | null
  content: string
  metadata: Record<string, unknown> | null
  similarity: number
}

export async function retrieveKnowledgeChunks(
  supabase: SupabaseClient,
  embedding: number[]
): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: toVectorLiteral(embedding),
    match_threshold: KNOWLEDGE_MATCH_THRESHOLD,
    match_count: KNOWLEDGE_MATCH_COUNT,
    filter_metadata: {},
  })

  if (error) {
    throw new Error(`Knowledge retrieval failed: ${error.message}`)
  }

  if (!Array.isArray(data)) {
    return []
  }

  return data.map((row) => mapKnowledgeRow(row as KnowledgeRpcRow))
}

export function hasSufficientContext(
  chunks: KnowledgeChunk[],
  question?: string
) {
  if (chunks.length === 0 || chunks[0].score < KNOWLEDGE_MATCH_THRESHOLD) {
    return false
  }

  if (!question) {
    return true
  }

  return chunks
    .slice(0, 3)
    .some((chunk) => hasQuestionEvidence(question, chunk))
}

export function toSources(chunks: KnowledgeChunk[]): RagSource[] {
  const seen = new Set<string>()

  return chunks.flatMap((chunk) => {
    const key = chunk.sourceUrl

    if (seen.has(key)) {
      return []
    }

    seen.add(key)

    return [
      {
        title: chunk.sourceTitle || chunk.sourceUrl,
        url: chunk.sourceUrl,
        chunkId: chunk.id,
        score: chunk.score,
      },
    ]
  })
}

function mapKnowledgeRow(row: KnowledgeRpcRow): KnowledgeChunk {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title ?? row.source_url,
    content: row.content,
    metadata: row.metadata ?? {},
    score: row.similarity,
  }
}

function hasQuestionEvidence(question: string, chunk: KnowledgeChunk) {
  if (chunk.score >= 0.72) {
    return true
  }

  const haystack = normalizeForEvidence(
    [chunk.sourceTitle, chunk.sourceUrl, chunk.content].join(" ")
  )
  const terms = expandEvidenceTerms(evidenceTerms(question))

  if (terms.length === 0) {
    return chunk.score >= 0.72
  }

  const matchedTerms = terms.filter((term) => haystack.includes(term))

  return matchedTerms.length >= Math.min(2, terms.length)
}

function expandEvidenceTerms(terms: string[]) {
  return Array.from(
    new Set(terms.flatMap((term) => [term, ...(evidenceSynonyms[term] ?? [])]))
  )
}

function evidenceTerms(question: string) {
  return Array.from(new Set(normalizeForEvidence(question).split(" "))).filter(
    (term) => term.length >= 4 && !evidenceStopWords.has(term)
  )
}

function normalizeForEvidence(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const evidenceStopWords = new Set([
  "sobre",
  "para",
  "quiero",
  "quisiera",
  "saber",
  "informacion",
  "dime",
  "cuentame",
  "hace",
  "cuanto",
  "cuantos",
  "universidad",
  "usil",
])

const evidenceSynonyms: Record<string, string[]> = {
  beca: ["financiamiento", "credito", "creditos", "convenio"],
  becas: ["financiamiento", "credito", "creditos", "convenio"],
  costo: ["costos", "tarifa", "tarifas", "pension", "pensiones", "cobranzas"],
  costos: ["tarifa", "tarifas", "pension", "pensiones", "cobranzas"],
  carreras: ["pregrado", "facultad", "facultades", "programas"],
  programas: ["pregrado", "facultad", "facultades", "carreras"],
  modalidades: ["admision", "ingreso", "postulacion"],
  fundacion: ["historia", "creacion", "fundada", "trayectoria"],
  fundada: ["fundacion", "historia", "creacion", "trayectoria"],
  creacion: ["fundacion", "fundada", "historia", "trayectoria"],
  creada: ["fundacion", "fundada", "historia", "trayectoria"],
  edad: ["fundacion", "fundada", "historia", "trayectoria"],
}
