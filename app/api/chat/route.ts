import { randomUUID } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"

import { after } from "next/server"
import { z } from "zod"

import { extractLeadCapture } from "@/lib/leads/extraction"
import {
  fetchLeadProfileBySession,
  upsertLeadCapture,
} from "@/lib/leads/repository"
import {
  hasMeaningfulLeadFields,
  scoreLeadCapture,
  type LeadCapture,
  type LeadFields,
  type LeadScore,
} from "@/lib/leads/scoring"
import { ServerEnvError } from "@/lib/server/env"
import { createServerSupabaseClient } from "@/lib/server/supabase"
import {
  generateAdmissionsAdvisorReply,
  generateContextFallbackReply,
  generateGroundedAnswer,
  generateOfficialWebSearchAnswer,
  hasDisallowedUserFacingWording,
  isUsilAdmissionsSalesQuestion,
  type AdvisorGenerationContext,
} from "@/lib/rag/answering"
import {
  buildContextualQuestion,
  fetchRecentConversationMessages,
  shouldBypassCacheForConversation,
  shouldUseAdmissionsAdvisorReply,
} from "@/lib/rag/conversation"
import {
  findExactSemanticCacheEntry,
  findSemanticCacheEntry,
  writeSemanticCacheEntry,
} from "@/lib/rag/cache"
import {
  createQuestionEmbedding,
  normalizeQuestion,
} from "@/lib/rag/embeddings"
import { enrichKnowledgeFromUrls } from "@/lib/rag/ingestion"
import {
  hasSufficientContext,
  retrieveKnowledgeChunks,
} from "@/lib/rag/retrieval"
import type { ChatResponse, GroundedAnswer } from "@/lib/rag/types"

const leadDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().min(6).max(40).optional(),
    program: z.string().trim().min(1).max(180).optional(),
    schedule: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

const chatRequestSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).max(4000),
    leadDraft: leadDraftSchema.optional(),
    fallbackUrls: z.array(z.string().trim().url().max(2048)).max(3).optional(),
  })
  .strict()

type ChatRequest = z.infer<typeof chatRequestSchema>

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const requestContextStore = new AsyncLocalStorage<{
  deferredTasks: (() => Promise<unknown>)[]
}>()

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json(
      {
        error: "Invalid JSON body.",
      },
      { status: 400 }
    )
  }

  const parsed = chatRequestSchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid chat request.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    )
  }

  const deferredTasks: (() => Promise<unknown>)[] = []
  let hasRequestScope = false

  try {
    after(async () => {
      for (const task of deferredTasks) {
        try {
          await task()
        } catch (error) {
          console.error("Deferred task failed", error)
        }
      }
    })
    hasRequestScope = true
  } catch {
    // Graceful fallback if after is called outside request scope (e.g. CLI test scripts)
  }

  try {
    const response = await requestContextStore.run(
      { deferredTasks },
      async () => {
        return processChatRequest(parsed.data)
      }
    )

    if (!hasRequestScope) {
      for (const task of deferredTasks) {
        task().catch((error) =>
          console.error("Fallback background task failed", error)
        )
      }
    }

    return Response.json(response)
  } catch (error) {
    if (error instanceof ServerEnvError) {
      return Response.json(
        {
          error: "Server configuration error.",
          message: error.message,
        },
        { status: 500 }
      )
    }

    console.error("Chat route failed", error)

    return Response.json(
      {
        error: "Unable to complete chat request from backend services.",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    )
  }
}

export async function processChatRequest(
  request: ChatRequest
): Promise<ChatResponse> {
  const timing = createTimingTracker()
  const sessionId = request.sessionId ?? randomUUID()
  const supabase = createServerSupabaseClient()
  timing.mark("setup")

  const [recentMessages, storedProfileFacts] = await Promise.all([
    fetchRecentConversationMessages({
      supabase,
      sessionId,
    }),
    fetchLeadProfileBySession({
      supabase,
      sessionId,
    }),
  ])
  timing.mark("dbFetch")

  const currentLeadCapture = await extractLeadCapture({
    message: request.message,
    leadDraft: request.leadDraft,
    history: recentMessages,
  })
  const currentMessageHasLeadFacts = hasMeaningfulLeadFields(
    currentLeadCapture.fields
  )
  const profileFacts = mergeLeadFields(
    storedProfileFacts,
    currentLeadCapture.fields
  )
  const profileHasFacts = hasMeaningfulLeadFields(profileFacts)
  const leadCapture = buildCumulativeLeadCapture({
    currentLeadCapture,
    profileFacts,
    profileHasFacts,
  })
  const leadScore = scoreLeadCapture(leadCapture)
  const shouldPersistLead =
    currentLeadCapture.commercialIntent || currentMessageHasLeadFacts
  const advisorContext: AdvisorGenerationContext = {
    history: recentMessages,
    profileFacts,
    currentFacts: currentLeadCapture.fields,
    leadScore,
  }
  const conversationStateMetadata = buildConversationStateMetadata({
    profileFacts,
    currentFacts: currentLeadCapture.fields,
    leadScore,
    history: recentMessages,
  })
  const shouldBypassCache =
    shouldBypassCacheForConversation(request.message) ||
    currentMessageHasLeadFacts ||
    profileHasFacts
  timing.mark("leadScoring")

  const normalizedQuestion = normalizeQuestion(request.message)
  const exactCachedAnswer = shouldBypassCache
    ? null
    : await findExactSemanticCacheEntry(supabase, normalizedQuestion)
  const safeExactCachedAnswer =
    exactCachedAnswer &&
    !hasDisallowedUserFacingWording(exactCachedAnswer.answer)
      ? exactCachedAnswer
      : null
  timing.mark("exactCacheLookup")

  if (safeExactCachedAnswer && !shouldBypassCache) {
    const response = buildResponse({
      answer: {
        answer: safeExactCachedAnswer.answer,
        sources: safeExactCachedAnswer.sources,
      },
      cache: "hit",
      leadScore,
      diagnostics: timing.diagnostics({
        sourceCount: safeExactCachedAnswer.sources.length,
      }),
      profileFields: profileFacts,
    })

    scheduleAfterResponse(async () => {
      return persistConversation({
        supabase,
        sessionId,
        request,
        response,
        metadata: {
          ...conversationStateMetadata,
          cache: "hit",
          cacheId: safeExactCachedAnswer.id,
          exactCache: true,
        },
      })
    }, "Persist exact cache-hit conversation")

    return response
  }

  const shouldUseAdvisorReply = shouldUseAdmissionsAdvisorReply({
    message: request.message,
    history: recentMessages,
    capture: currentLeadCapture,
  })
  timing.mark("conversationContext")

  if (shouldUseAdvisorReply) {
    const [advisorAnswer, persistedLead] = await Promise.all([
      generateAdmissionsAdvisorReply({
        message: request.message,
        advisorContext,
      }),
      persistLeadIfNeeded({
        supabase,
        sessionId,
        leadScore,
        leadCapture,
        shouldPersistLead,
      }),
    ])
    timing.mark("leadPersistence")
    const response = buildResponse({
      answer: advisorAnswer,
      cache: "miss",
      leadId: persistedLead?.id,
      leadScore,
      diagnostics: timing.diagnostics({
        sourceCount: 0,
        webSearchAttempted: false,
        webSearchStatus: "not_applicable",
      }),
      profileFields: profileFacts,
    })

    scheduleAfterResponse(
      () =>
        persistConversation({
          supabase,
          sessionId,
          request,
          response,
          leadId: persistedLead?.id,
          metadata: {
            ...conversationStateMetadata,
            cache: "miss",
            advisorConversation: true,
            timingsMs: response.diagnostics?.timingsMs,
            profileFactsPresent: profileHasFacts,
          },
        }),
      "Persist conversation shortcut"
    )

    return response
  }

  const contextualQuestion = buildContextualQuestion({
    message: request.message,
    history: recentMessages,
  })

  const questionEmbedding = await createQuestionEmbedding(contextualQuestion)
  timing.mark("embedding")

  const cachedAnswer = shouldBypassCache
    ? null
    : await findSemanticCacheEntry(supabase, questionEmbedding.embedding)
  const safeCachedAnswer =
    cachedAnswer && !hasDisallowedUserFacingWording(cachedAnswer.answer)
      ? cachedAnswer
      : null
  timing.mark("cacheLookup")

  if (safeCachedAnswer) {
    const response = buildResponse({
      answer: {
        answer: safeCachedAnswer.answer,
        sources: safeCachedAnswer.sources,
      },
      cache: "hit",
      leadScore,
      diagnostics: timing.diagnostics({
        sourceCount: safeCachedAnswer.sources.length,
      }),
      profileFields: profileFacts,
    })

    scheduleAfterResponse(async () => {
      return persistConversation({
        supabase,
        sessionId,
        request,
        response,
        metadata: {
          ...conversationStateMetadata,
          cache: "hit",
          cacheId: safeCachedAnswer.id,
        },
      })
    }, "Persist cache-hit conversation")

    return response
  }

  const initialChunks = await retrieveKnowledgeChunks(
    supabase,
    questionEmbedding.embedding
  )
  timing.mark("initialRetrieval")

  const enrichmentResults =
    !hasSufficientContext(initialChunks, request.message) &&
    request.fallbackUrls?.length
      ? await enrichKnowledgeFromUrls({
          supabase,
          question: contextualQuestion,
          urls: request.fallbackUrls,
        })
      : []
  timing.mark("fallbackEnrichment")

  const shouldRetryRetrieval = enrichmentResults.some(
    (result) => result.status === "ingested"
  )
  const chunks = shouldRetryRetrieval
    ? await retrieveKnowledgeChunks(supabase, questionEmbedding.embedding)
    : initialChunks
  timing.mark("finalRetrieval")

  const hasLocalContext = hasSufficientContext(chunks, request.message)
  timing.mark("fastAnswer")

  const shouldUseWebSearchFallback =
    !hasLocalContext && isUsilAdmissionsSalesQuestion(contextualQuestion)
  const webSearchAnswer = shouldUseWebSearchFallback
    ? await generateOfficialWebSearchAnswer({
        question: contextualQuestion,
        advisorContext,
      })
    : null
  timing.mark("webSearchFallback")

  const groundedAnswer =
    (webSearchAnswer?.sources.length ? webSearchAnswer : null) ??
    (hasLocalContext
      ? await generateGroundedAnswer({
          question: contextualQuestion,
          chunks,
          advisorContext,
        })
      : (webSearchAnswer ??
        (await generateContextFallbackReply({
          message: contextualQuestion,
          advisorContext,
        }))))
  timing.mark("answering")

  const persistedLead = await persistLeadIfNeeded({
    supabase,
    sessionId,
    leadScore,
    leadCapture,
    shouldPersistLead,
  })
  timing.mark("leadPersistence")

  const response = buildResponse({
    answer: groundedAnswer,
    cache: "miss",
    leadId: persistedLead?.id,
    leadScore,
    diagnostics: timing.diagnostics({
      knowledgeMatchCount: chunks.length,
      initialKnowledgeMatchCount: initialChunks.length,
      sourceCount: groundedAnswer.sources.length,
      webSearchAttempted: shouldUseWebSearchFallback,
      webSearchStatus: webSearchAnswer?.status ?? "not_applicable",
      webSearchError: webSearchAnswer?.error,
    }),
    profileFields: profileFacts,
  })

  scheduleAfterResponse(
    () =>
      persistConversation({
        supabase,
        sessionId,
        request,
        response,
        leadId: persistedLead?.id,
        metadata: {
          ...conversationStateMetadata,
          cache: "miss",
          knowledgeMatchCount: chunks.length,
          initialKnowledgeMatchCount: initialChunks.length,
          fallbackEnrichment: summarizeEnrichmentResults(enrichmentResults),
          contextualQuestionApplied: contextualQuestion !== request.message,
          insufficientContext: response.sources.length === 0,
          timingsMs: response.diagnostics?.timingsMs,
        },
      }),
    "Persist cache-miss conversation"
  )

  if (
    response.sources.length > 0 &&
    !profileHasFacts &&
    recentMessages.length === 0
  ) {
    scheduleAfterResponse(
      () =>
        writeSemanticCacheEntry({
          supabase,
          question: request.message,
          normalizedQuestion: questionEmbedding.normalizedQuestion,
          answer: response.answer,
          embedding: questionEmbedding.embedding,
          sources: response.sources,
        }),
      "Write semantic cache entry"
    )
  }

  return response
}

function buildResponse(params: {
  answer: GroundedAnswer
  cache: "hit" | "miss"
  leadId?: string
  leadScore: LeadScore
  diagnostics: ChatResponse["diagnostics"]
  profileFields?: LeadFields
}): ChatResponse {
  return {
    answer: params.answer.answer,
    sources: params.answer.sources,
    lead: {
      id: params.leadId,
      score: params.leadScore.score,
      category: params.leadScore.category,
      missingFields: params.leadScore.missingFields,
    },
    nextAction:
      params.leadScore.nextAction ??
      getRagNextAction(params.answer.sources.length),
    cache: params.cache,
    diagnostics: params.diagnostics,
    profileFields: params.profileFields,
  }
}

function scheduleAfterResponse(work: () => Promise<unknown>, label: string) {
  const store = requestContextStore.getStore()
  if (store) {
    store.deferredTasks.push(work)
  } else {
    work().catch((error) => console.error(`${label} fallback failed`, error))
  }
}

function createTimingTracker() {
  const startedAt = Date.now()
  let lastMarkAt = startedAt
  const timingsMs: Record<string, number> = {}

  return {
    mark(label: string) {
      const now = Date.now()
      timingsMs[label] = now - lastMarkAt
      lastMarkAt = now
    },
    diagnostics(
      extra: Omit<
        NonNullable<ChatResponse["diagnostics"]>,
        "totalMs" | "timingsMs"
      >
    ) {
      return {
        totalMs: Date.now() - startedAt,
        timingsMs,
        ...extra,
      }
    },
  }
}

function persistLeadIfNeeded(params: {
  supabase: ReturnType<typeof createServerSupabaseClient>
  sessionId: string
  leadScore: LeadScore
  leadCapture: LeadCapture
  shouldPersistLead: boolean
}) {
  return params.shouldPersistLead && params.leadScore.shouldCreateOrUpdateLead
    ? upsertLeadCapture({
        supabase: params.supabase,
        sessionId: params.sessionId,
        capture: params.leadCapture,
        scoring: params.leadScore,
      })
    : Promise.resolve(null)
}

function buildCumulativeLeadCapture(params: {
  currentLeadCapture: LeadCapture
  profileFacts: LeadFields
  profileHasFacts: boolean
}): LeadCapture {
  return {
    ...params.currentLeadCapture,
    fields: params.profileFacts,
    commercialIntent:
      params.currentLeadCapture.commercialIntent ||
      hasMeaningfulLeadFields(params.currentLeadCapture.fields),
    informationalOnly:
      params.currentLeadCapture.informationalOnly && !params.profileHasFacts,
  }
}

function mergeLeadFields(
  storedProfileFacts: LeadFields,
  currentMessageFacts: LeadFields
): LeadFields {
  return Object.fromEntries(
    Object.entries({
      ...storedProfileFacts,
      ...currentMessageFacts,
    }).flatMap(([key, value]) => {
      const normalizedValue = value?.trim()

      return normalizedValue ? [[key, normalizedValue]] : []
    })
  ) as LeadFields
}

function buildConversationStateMetadata(params: {
  profileFacts: LeadFields
  currentFacts: LeadFields
  leadScore: LeadScore
  history: Awaited<ReturnType<typeof fetchRecentConversationMessages>>
}) {
  return {
    conversationState: {
      lead: compactMetadataRecord({
        name: params.profileFacts.name,
        lastname: params.profileFacts.lastName,
        age: params.profileFacts.age,
        phone: params.profileFacts.phone,
        email: params.profileFacts.email,
      }),
      education: compactMetadataRecord({
        status: params.profileFacts.currentStatus,
        school:
          params.profileFacts.school ?? params.profileFacts.originInstitution,
        graduation_year: params.profileFacts.graduationYear,
        current_university: params.profileFacts.currentUniversity,
      }),
      interest: compactMetadataRecord({
        faculty: params.profileFacts.faculty,
        career: params.profileFacts.program,
        campus: params.profileFacts.campus,
        modality: params.profileFacts.modality,
      }),
      location: compactMetadataRecord({
        country: params.profileFacts.country,
        city: params.profileFacts.city,
      }),
      qualification: compactMetadataRecord({
        interest_level: params.profileFacts.interestLevel,
        budget: params.profileFacts.budget,
        urgency: params.profileFacts.urgency,
        objections: params.profileFacts.objections,
        score: params.leadScore.score,
        category: params.leadScore.category,
      }),
      history: {
        facts: Object.keys(params.profileFacts),
        answered_questions: inferAnsweredTopics(params.history),
      },
      next_goal:
        params.leadScore.nextAction ??
        "Guide the prospect toward the next admissions step.",
      currentFacts: params.currentFacts,
    },
  }
}

function compactMetadataRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) => {
      if (typeof value === "string") {
        const normalizedValue = value.trim()

        return normalizedValue ? [[key, normalizedValue]] : []
      }

      return value === undefined || value === null ? [] : [[key, value]]
    })
  )
}

function inferAnsweredTopics(
  history: Awaited<ReturnType<typeof fetchRecentConversationMessages>>
) {
  const text = normalizeForTopic(
    history.map((message) => message.content).join(" ")
  )
  const topics: string[] = []

  if (/\b(modalidad|modalidades|admision|postulacion)\b/.test(text)) {
    topics.push("modalidades/admisión")
  }

  if (/\b(carrera|carreras|programa|programas|pregrado)\b/.test(text)) {
    topics.push("carreras/programas")
  }

  if (
    /\b(beca|becas|financiamiento|costo|costos|pension|pensiones)\b/.test(text)
  ) {
    topics.push("financiamiento/costos")
  }

  if (/\b(inscribirme|inscripcion|postular|matricula)\b/.test(text)) {
    topics.push("postulación/inscripción")
  }

  return Array.from(new Set(topics))
}

function normalizeForTopic(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

async function persistConversation(params: {
  supabase: ReturnType<typeof createServerSupabaseClient>
  sessionId: string
  request: ChatRequest
  response: ChatResponse
  leadId?: string
  metadata: Record<string, unknown>
}) {
  const { error } = await params.supabase.from("messages").insert([
    {
      session_id: params.sessionId,
      lead_id: params.leadId ?? null,
      role: "user",
      content: params.request.message,
      sources: [],
      metadata: {
        ...params.metadata,
        direction: "incoming",
        leadCategory: params.response.lead.category,
        leadScore: params.response.lead.score,
      },
    },
    {
      session_id: params.sessionId,
      lead_id: params.leadId ?? null,
      role: "assistant",
      content: params.response.answer,
      sources: params.response.sources,
      metadata: {
        ...params.metadata,
        direction: "outgoing",
        leadCategory: params.response.lead.category,
        leadScore: params.response.lead.score,
      },
    },
  ])

  if (error) {
    throw new Error(`Message persistence failed: ${error.message}`)
  }
}

function getRagNextAction(sourceCount: number) {
  if (sourceCount === 0) {
    return "Contame qué carrera, campus o modalidad te interesa y te ayudo con el siguiente paso de admisión USIL."
  }

  return undefined
}

function summarizeEnrichmentResults(
  results: Awaited<ReturnType<typeof enrichKnowledgeFromUrls>>
) {
  if (results.length === 0) {
    return {
      attempted: false,
      accepted: 0,
      rejected: 0,
      skipped: 0,
    }
  }

  return {
    attempted: true,
    accepted: results.filter((result) => result.status === "ingested").length,
    rejected: results.filter((result) => result.status === "rejected").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    reasons: results.map((result) => ({
      url: result.url,
      status: result.status,
      reason: "reason" in result ? result.reason : undefined,
    })),
  }
}
