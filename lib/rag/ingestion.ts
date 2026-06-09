import { createHash } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import * as cheerio from "cheerio"

import {
  createOpenAIClient,
  getOpenAIEmbeddingModel,
} from "@/lib/server/openai"

import { toVectorLiteral } from "./embeddings"
import { EMBEDDING_DIMENSIONS } from "./types"

const allowedUsilHostSuffix = ".usil.edu.pe"
const allowedUsilHosts = new Set(["usil.edu.pe", "www.usil.edu.pe"])
const fetchTimeoutMs = 12_000
const minCleanContentLength = 240
const maxChunkWords = 320
const chunkOverlapWords = 50
const minFallbackConfidence = 0.28
const maxFallbackContentAgeDays = 365 * 3

type IngestionSourceType = "web" | "fallback"

type FetchHtmlResult = {
  html: string
  finalUrl: string
  lastModified?: string
}

type CleanedHtml = {
  title: string
  description?: string
  text: string
}

type TextChunk = {
  content: string
  checksum: string
  tokenCount: number
}

export type IngestionAcceptedResult = {
  status: "ingested"
  url: string
  sourceId: string
  chunkCount: number
  checksum: string
  confidence: number
}

export type IngestionSkippedResult = {
  status: "skipped"
  url: string
  reason: "duplicate" | "empty" | "low-confidence" | "stale"
  checksum?: string
  confidence?: number
}

export type IngestionRejectedResult = {
  status: "rejected"
  url: string
  reason: "non-allowlisted" | "invalid-url" | "fetch-failed"
  message?: string
}

export type IngestionResult =
  | IngestionAcceptedResult
  | IngestionSkippedResult
  | IngestionRejectedResult

type IngestUrlParams = {
  supabase: SupabaseClient
  url: string
  sourceType?: IngestionSourceType
  relevanceQuestion?: string
  requireFreshness?: boolean
  metadata?: Record<string, unknown>
}

type IngestManyParams = {
  supabase: SupabaseClient
  urls: string[]
  metadata?: Record<string, unknown>
}

type FallbackEnrichmentParams = {
  supabase: SupabaseClient
  question: string
  urls: string[]
}

type KnowledgeSourceRow = {
  id: string
  url: string
  content_checksum: string | null
  last_embedded_at: string | null
}

export function isAllowedUsilUrl(value: string) {
  const url = parseUrl(value)

  if (!url) {
    return false
  }

  return (
    isAllowedUsilHostname(url.hostname) &&
    ["https:", "http:"].includes(url.protocol)
  )
}

export function normalizeUsilUrl(value: string) {
  const parsed = parseUrl(value)

  if (!parsed || !isAllowedUsilUrl(value)) {
    return null
  }

  parsed.protocol = "https:"
  parsed.hash = ""
  parsed.searchParams.sort()

  const normalized = parsed.toString()
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

export async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs)

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "agentic-sales-usil-rag-ingestion/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get("content-type") ?? ""

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`)
    }

    return {
      html: await response.text(),
      finalUrl: response.url,
      lastModified: response.headers.get("last-modified") ?? undefined,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function cleanHtml(html: string): CleanedHtml {
  const $ = cheerio.load(html)
  const structuredDataText = $("script[type='application/ld+json']")
    .map((_, element) => extractJsonLdText($(element).text()))
    .get()

  $(
    "script, style, noscript, svg, canvas, iframe, form, input, button, nav, footer, header, aside"
  ).remove()

  const title = firstClean([
    $("meta[property='og:title']").attr("content"),
    $("meta[name='twitter:title']").attr("content"),
    $("title").text(),
    $("h1").first().text(),
  ])
  const description = firstClean([
    $("meta[name='description']").attr("content"),
    $("meta[property='og:description']").attr("content"),
    $("meta[name='twitter:description']").attr("content"),
  ])
  const rootText = $("main").text() || $("article").text() || $("body").text()
  const primaryText = dedupeLines(rootText)
  const fallbackText = collectFallbackText(
    $,
    title,
    description,
    structuredDataText
  )
  const text =
    primaryText.length >= minCleanContentLength
      ? primaryText
      : dedupeLines([primaryText, fallbackText].filter(Boolean).join("\n"))

  return {
    title: title || "USIL source",
    description: description || undefined,
    text,
  }
}

export function chunkText(text: string): TextChunk[] {
  const words = cleanWhitespace(text).split(" ").filter(Boolean)

  if (words.length === 0) {
    return []
  }

  const chunks: TextChunk[] = []
  let index = 0

  while (index < words.length) {
    const chunkWords = words.slice(index, index + maxChunkWords)
    const content = chunkWords.join(" ").trim()

    if (content.length >= minCleanContentLength || chunks.length === 0) {
      chunks.push({
        content,
        checksum: createContentChecksum(content),
        tokenCount: chunkWords.length,
      })
    }

    if (index + maxChunkWords >= words.length) {
      break
    }

    index += maxChunkWords - chunkOverlapWords
  }

  return chunks
}

export function createContentChecksum(content: string) {
  return createHash("sha256")
    .update(cleanWhitespace(content).toLowerCase())
    .digest("hex")
}

export async function createTextEmbeddings(inputs: string[]) {
  if (inputs.length === 0) {
    return []
  }

  const openai = createOpenAIClient()
  const response = await openai.embeddings.create({
    model: getOpenAIEmbeddingModel(),
    input: inputs,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const embeddings = response.data.map((item) => item.embedding)

  if (embeddings.length !== inputs.length) {
    throw new Error(
      "Embedding provider returned an unexpected number of vectors."
    )
  }

  for (const embedding of embeddings) {
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding provider returned an invalid vector dimension for ${getOpenAIEmbeddingModel()}.`
      )
    }
  }

  return embeddings
}

export async function ingestUsilUrl(
  params: IngestUrlParams
): Promise<IngestionResult> {
  const normalizedUrl = normalizeUsilUrl(params.url)

  if (!normalizedUrl) {
    return {
      status: "rejected",
      url: params.url,
      reason: parseUrl(params.url) ? "non-allowlisted" : "invalid-url",
    }
  }

  let fetched: FetchHtmlResult

  try {
    fetched = await fetchHtml(normalizedUrl)
  } catch (error) {
    return {
      status: "rejected",
      url: normalizedUrl,
      reason: "fetch-failed",
      message:
        error instanceof Error ? error.message : "Unexpected fetch failure",
    }
  }

  const finalUrl = normalizeUsilUrl(fetched.finalUrl)

  if (!finalUrl) {
    return {
      status: "rejected",
      url: fetched.finalUrl,
      reason: "non-allowlisted",
    }
  }

  const cleaned = cleanHtml(fetched.html)
  const contentChecksum = createContentChecksum(cleaned.text)
  const confidence = params.relevanceQuestion
    ? calculateRelevanceConfidence(params.relevanceQuestion, cleaned.text)
    : 1

  if (cleaned.text.length < minCleanContentLength) {
    return {
      status: "skipped",
      url: finalUrl,
      reason: "empty",
      checksum: contentChecksum,
      confidence,
    }
  }

  if (params.requireFreshness && isKnownStale(fetched.lastModified)) {
    return {
      status: "skipped",
      url: finalUrl,
      reason: "stale",
      checksum: contentChecksum,
      confidence,
    }
  }

  if (params.relevanceQuestion && confidence < minFallbackConfidence) {
    return {
      status: "skipped",
      url: finalUrl,
      reason: "low-confidence",
      checksum: contentChecksum,
      confidence,
    }
  }

  const existingSource = await findExistingSource(
    params.supabase,
    finalUrl,
    contentChecksum
  )

  if (existingSource && existingSource.content_checksum === contentChecksum) {
    const activeChunkCount = await countActiveChunks(
      params.supabase,
      existingSource.id
    )

    if (existingSource.last_embedded_at && activeChunkCount > 0) {
      return {
        status: "skipped",
        url: finalUrl,
        reason: "duplicate",
        checksum: contentChecksum,
        confidence,
      }
    }

    if (existingSource.url !== finalUrl) {
      await repairKnowledgeSourceUrl({
        supabase: params.supabase,
        sourceId: existingSource.id,
        url: finalUrl,
      })
    }
  }

  const chunks = chunkText(cleaned.text)

  if (chunks.length === 0) {
    return {
      status: "skipped",
      url: finalUrl,
      reason: "empty",
      checksum: contentChecksum,
      confidence,
    }
  }

  const source = await upsertKnowledgeSource({
    supabase: params.supabase,
    url: finalUrl,
    sourceType: params.sourceType ?? "web",
    title: cleaned.title,
    description: cleaned.description,
    contentChecksum,
    lastModified: fetched.lastModified,
    metadata: {
      ...params.metadata,
      confidence,
      finalUrl,
      cleanedCharacterLength: cleaned.text.length,
    },
  })
  const embeddings = await createTextEmbeddings(
    chunks.map((chunk) => chunk.content)
  )

  await persistKnowledgeChunks({
    supabase: params.supabase,
    sourceId: source.id,
    sourceUrl: finalUrl,
    chunks,
    embeddings,
    metadata: {
      ...params.metadata,
      confidence,
      sourceTitle: cleaned.title,
    },
  })

  return {
    status: "ingested",
    url: finalUrl,
    sourceId: source.id,
    chunkCount: chunks.length,
    checksum: contentChecksum,
    confidence,
  }
}

export async function ingestUsilUrls(
  params: IngestManyParams
): Promise<IngestionResult[]> {
  const uniqueUrls = Array.from(new Set(params.urls))
  const results: IngestionResult[] = []

  for (const url of uniqueUrls) {
    results.push(
      await ingestUsilUrl({
        supabase: params.supabase,
        url,
        sourceType: "web",
        metadata: {
          ...params.metadata,
          ingestionMode: "cli",
        },
      })
    )
  }

  return results
}

export async function enrichKnowledgeFromUrls(
  params: FallbackEnrichmentParams
): Promise<IngestionResult[]> {
  const uniqueUrls = Array.from(new Set(params.urls)).slice(0, 3)
  const results: IngestionResult[] = []

  for (const url of uniqueUrls) {
    results.push(
      await ingestUsilUrl({
        supabase: params.supabase,
        url,
        sourceType: "fallback",
        relevanceQuestion: params.question,
        requireFreshness: true,
        metadata: {
          ingestionMode: "fallback",
          fallbackQuestionChecksum: createContentChecksum(params.question),
        },
      })
    )
  }

  return results
}

function parseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isAllowedUsilHostname(hostname: string) {
  const normalized = hostname.toLowerCase()
  return (
    allowedUsilHosts.has(normalized) ||
    normalized.endsWith(allowedUsilHostSuffix)
  )
}

function cleanWhitespace(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function firstClean(values: Array<string | undefined>) {
  for (const value of values) {
    const cleaned = cleanWhitespace(value)

    if (cleaned) {
      return cleaned
    }
  }

  return ""
}

function dedupeLines(value: string) {
  const seen = new Set<string>()

  return value
    .split(/\n+/)
    .map(cleanWhitespace)
    .filter((line) => line.length > 2)
    .filter((line) => {
      const key = line.toLowerCase()

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function collectFallbackText(
  $: cheerio.CheerioAPI,
  title: string,
  description: string | undefined,
  structuredDataText: string[]
) {
  const parts = [title, description, ...structuredDataText]

  $("meta[property^='og:'], meta[name^='twitter:']").each((_, element) => {
    parts.push($(element).attr("content"))
  })

  $(
    "h1, h2, h3, [class*='card'], [class*='Card'], [id*='card'], [id*='Card'], a"
  ).each((_, element) => {
    const value = cleanWhitespace($(element).text())

    if (value.length >= 3) {
      parts.push(value)
    }
  })

  return dedupeLines(parts.filter(Boolean).join("\n"))
}

function extractJsonLdText(rawJson: string) {
  try {
    const parsed = JSON.parse(rawJson) as unknown
    const values: string[] = []
    collectJsonLdStrings(parsed, values)
    return values
  } catch {
    return []
  }
}

function collectJsonLdStrings(value: unknown, values: string[]) {
  if (typeof value === "string") {
    const cleaned = cleanWhitespace(value)

    if (cleaned.length >= 3) {
      values.push(cleaned)
    }

    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdStrings(item, values)
    }

    return
  }

  if (!value || typeof value !== "object") {
    return
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isUsefulStructuredDataKey(key)) {
      collectJsonLdStrings(nestedValue, values)
    }
  }
}

function isUsefulStructuredDataKey(key: string) {
  return [
    "name",
    "headline",
    "alternativeHeadline",
    "description",
    "text",
    "articleBody",
    "about",
    "keywords",
    "itemListElement",
    "mainEntity",
    "mainEntityOfPage",
  ].includes(key)
}

function calculateRelevanceConfidence(question: string, content: string) {
  const questionTerms = tokenize(question)
  const contentTerms = new Set(tokenize(content))

  if (questionTerms.length === 0) {
    return 0
  }

  const matchedTerms = questionTerms.filter((term) => contentTerms.has(term))
  return matchedTerms.length / Math.min(questionTerms.length, 8)
}

function tokenize(value: string) {
  const stopwords = new Set([
    "para",
    "sobre",
    "quiero",
    "quisiera",
    "informacion",
    "información",
    "como",
    "cómo",
    "cual",
    "cuál",
    "que",
    "qué",
    "the",
    "and",
    "with",
  ])

  return Array.from(
    new Set(
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .match(/[a-z0-9]{4,}/g)
        ?.filter((term) => !stopwords.has(term)) ?? []
    )
  )
}

function isKnownStale(lastModified?: string) {
  if (!lastModified) {
    return false
  }

  const modifiedAt = Date.parse(lastModified)

  if (Number.isNaN(modifiedAt)) {
    return false
  }

  const ageMs = Date.now() - modifiedAt
  return ageMs > maxFallbackContentAgeDays * 24 * 60 * 60 * 1000
}

async function findExistingSource(
  supabase: SupabaseClient,
  url: string,
  contentChecksum: string
): Promise<KnowledgeSourceRow | null> {
  const { data: sourceByUrl, error: sourceByUrlError } = await supabase
    .from("knowledge_sources")
    .select("id, url, content_checksum, last_embedded_at")
    .eq("url", url)
    .limit(1)
    .maybeSingle()

  if (sourceByUrlError) {
    throw new Error(
      `Knowledge source lookup failed: ${sourceByUrlError.message}`
    )
  }

  if (sourceByUrl) {
    return sourceByUrl as KnowledgeSourceRow
  }

  const { data: sourceByChecksum, error: sourceByChecksumError } =
    await supabase
      .from("knowledge_sources")
      .select("id, url, content_checksum, last_embedded_at")
      .eq("content_checksum", contentChecksum)
      .limit(1)
      .maybeSingle()

  if (sourceByChecksumError) {
    throw new Error(
      `Knowledge source checksum lookup failed: ${sourceByChecksumError.message}`
    )
  }

  return (sourceByChecksum as KnowledgeSourceRow | null) ?? null
}

async function countActiveChunks(supabase: SupabaseClient, sourceId: string) {
  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("status", "active")

  if (error) {
    throw new Error(`Knowledge chunk count lookup failed: ${error.message}`)
  }

  return count ?? 0
}

async function repairKnowledgeSourceUrl(params: {
  supabase: SupabaseClient
  sourceId: string
  url: string
}) {
  const { error } = await params.supabase
    .from("knowledge_sources")
    .update({ url: params.url })
    .eq("id", params.sourceId)

  if (error) {
    throw new Error(`Knowledge source repair failed: ${error.message}`)
  }
}

async function upsertKnowledgeSource(params: {
  supabase: SupabaseClient
  url: string
  sourceType: IngestionSourceType
  title: string
  description?: string
  contentChecksum: string
  lastModified?: string
  metadata: Record<string, unknown>
}): Promise<{ id: string }> {
  const now = new Date().toISOString()
  const { data, error } = await params.supabase
    .from("knowledge_sources")
    .upsert(
      {
        source_type: params.sourceType,
        url: params.url,
        title: params.title,
        description: params.description ?? null,
        status: "active",
        content_checksum: params.contentChecksum,
        last_fetched_at: now,
        metadata: {
          ...params.metadata,
          lastModified: params.lastModified ?? null,
        },
      },
      { onConflict: "url" }
    )
    .select("id")
    .single()

  if (error) {
    throw new Error(`Knowledge source upsert failed: ${error.message}`)
  }

  return data as { id: string }
}

async function persistKnowledgeChunks(params: {
  supabase: SupabaseClient
  sourceId: string
  sourceUrl: string
  chunks: TextChunk[]
  embeddings: number[][]
  metadata: Record<string, unknown>
}) {
  const rows = params.chunks.map((chunk, index) => ({
    source_id: params.sourceId,
    chunk_index: index,
    content: chunk.content,
    content_checksum: chunk.checksum,
    embedding: toVectorLiteral(params.embeddings[index] ?? []),
    token_count: chunk.tokenCount,
    status: "active",
    metadata: {
      ...params.metadata,
      sourceUrl: params.sourceUrl,
      chunkIndex: index,
    },
  }))

  const { error } = await params.supabase
    .from("knowledge_chunks")
    .upsert(rows, { onConflict: "source_id,chunk_index" })

  if (error) {
    throw new Error(`Knowledge chunk upsert failed: ${error.message}`)
  }

  await archiveOverflowChunks(
    params.supabase,
    params.sourceId,
    params.chunks.length
  )

  const { error: updateError } = await params.supabase
    .from("knowledge_sources")
    .update({ last_embedded_at: new Date().toISOString() })
    .eq("id", params.sourceId)

  if (updateError) {
    throw new Error(
      `Knowledge source embed timestamp update failed: ${updateError.message}`
    )
  }
}

async function archiveOverflowChunks(
  supabase: SupabaseClient,
  sourceId: string,
  chunkCount: number
) {
  const { error } = await supabase
    .from("knowledge_chunks")
    .update({ status: "archived" })
    .eq("source_id", sourceId)
    .gte("chunk_index", chunkCount)

  if (error) {
    throw new Error(`Knowledge chunk archive failed: ${error.message}`)
  }
}
