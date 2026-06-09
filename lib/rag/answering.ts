import { createHash } from "node:crypto"

import {
  createOpenAIClient,
  getOpenAIAnswerModel,
  getOpenAIWebSearchModel,
} from "@/lib/server/openai"
import type { LeadFields, LeadScore } from "@/lib/leads/scoring"

import {
  isInstitutionalUsilQuestion,
  type RecentConversationMessage,
} from "./conversation"
import { toSources } from "./retrieval"
import type {
  GroundedAnswer,
  KnowledgeChunk,
  RagSource,
  WebSearchFallbackAnswer,
} from "./types"

const MAX_ANSWER_CHUNKS = 5
const MAX_CONTEXT_CHARS_PER_CHUNK = 1200
const OFFICIAL_USIL_DOMAIN = "usil.edu.pe"
const MAX_ADVISOR_HISTORY_MESSAGES = 8
const PROFILE_FIELD_ORDER = [
  "name",
  "lastName",
  "age",
  "originInstitution",
  "school",
  "graduationYear",
  "currentUniversity",
  "currentStatus",
  "country",
  "city",
  "faculty",
  "program",
  "modality",
  "campus",
  "email",
  "phone",
  "schedule",
  "budget",
  "urgency",
  "objections",
  "interestLevel",
] as const satisfies readonly (keyof LeadFields)[]
const ADMISSIONS_PROFILE_PRIORITY = [
  "program",
  "currentStatus",
  "age",
  "school",
  "originInstitution",
  "city",
  "country",
  "modality",
  "campus",
  "email",
  "phone",
] as const satisfies readonly (keyof LeadFields)[]
const PROFILE_FIELD_LABELS: Record<
  (typeof PROFILE_FIELD_ORDER)[number],
  string
> = {
  name: "Nombre",
  lastName: "Apellido",
  age: "Edad",
  originInstitution: "Colegio, instituto o universidad de origen",
  school: "Colegio",
  graduationYear: "Año de egreso/promoción",
  currentUniversity: "Universidad actual",
  currentStatus: "Situación actual",
  country: "País",
  city: "Ciudad",
  faculty: "Facultad de interés",
  program: "Carrera de interés",
  modality: "Modalidad de interés",
  campus: "Campus de interés",
  email: "Email",
  phone: "Teléfono",
  schedule: "Horario preferido",
  budget: "Presupuesto o necesidad financiera",
  urgency: "Urgencia",
  objections: "Objeciones o dudas",
  interestLevel: "Nivel de interés",
}

export type AdvisorGenerationContext = {
  history: RecentConversationMessage[]
  profileFacts: LeadFields
  currentFacts?: LeadFields
  leadScore?: LeadScore
}

const USIL_ADMISSIONS_ADVISOR_INSTRUCTIONS = `Eres el Asistente Oficial de Admisión de la Universidad San Ignacio de Loyola (USIL).
No eres un bot de FAQ: eres un asesor humano, cálido y profesional de admisiones.
Objetivo principal: entender intención real, retener contexto, personalizar, calificar el lead, resolver objeciones y guiar hacia el siguiente paso de conversión.
Usa toda la conversación y el estado estructurado como contexto. Nunca reinicies la conversación y nunca vuelvas a preguntar un dato que ya aparece como conocido.
Si el usuario reclama que ya dio un dato, reconoce brevemente el error, menciona el dato conocido si está en el perfil y continúa sin pedirlo otra vez.
Captura progresivamente nombre, apellido, edad, colegio/universidad, ciudad/país, carrera/facultad, campus, modalidad y situación actual; no interrogues.
Si el usuario entrega solo información personal, agradécela, incorpórala de forma natural y avanza con una sola pregunta importante.
Si el usuario hace una pregunta factual de USIL, responde primero con contexto oficial disponible y luego haz una sola pregunta de calificación relacionada.
Formula como máximo una pregunta por mensaje, y esa pregunta debe pedir una sola cosa.
Nunca hagas preguntas compuestas del tipo "carrera y modalidad", "ciudad o campus" o varias alternativas en una misma pregunta; elige solo el siguiente dato prioritario.
No inventes precios, condiciones de becas, fechas, garantías de admisión, enlaces ni compromisos oficiales no sustentados por contexto oficial.
No enumeres modalidades de estudio, campus, costos, becas o beneficios específicos salvo que aparezcan en el contexto oficial recuperado o el usuario ya los haya mencionado.
Evita frases robóticas como "¿Cómo puedo ayudarte?", "puedo asistirte", "¿qué deseas saber?", "estoy aquí para ayudarte" y equivalentes genéricos.
Evita mencionar detalles internos de implementación, datos de entrenamiento, limitaciones técnicas, nombres de sistemas internos, knowledge base, seed o base actual.
Longitud por defecto: 3 a 6 oraciones; si el usuario escribe algo corto, responde breve pero con valor.
Responde en español cuando el usuario escriba en español, con tono cálido, profesional y peruano-neutral.`

export function buildInsufficientContextAnswer(
  question?: string,
  advisorContext?: AdvisorGenerationContext
): GroundedAnswer {
  const program = advisorContext?.profileFacts?.program
  const name = advisorContext?.profileFacts?.name

  if (isInstitutionalUsilQuestion(question ?? "")) {
    const defaultAnswer = program
      ? `Te ayudo con esa duda institucional de USIL. Para confirmar el dato exacto sin inventarlo, conviene revisarlo en los canales oficiales de USIL. Como sé que te interesa ${program}, ¿quieres avanzar con tu admisión?`
      : "Te ayudo con esa duda institucional de USIL. Para confirmar el dato exacto sin inventarlo, conviene revisarlo en los canales oficiales de USIL. ¿Qué carrera te interesa revisar para avanzar con admisión?"
    return {
      answer: defaultAnswer,
      sources: [],
    }
  }

  const isFinancial = isFinancialQuestion(normalizeForIntent(question ?? ""))
  if (program) {
    const personalizedName = name ? `${name}, ` : ""
    const answer = isFinancial
      ? `${personalizedName}para montos y becas exactas en la carrera de ${program}, conviene revisarlo directamente con admisiones. ¿Te gustaría coordinar el contacto con un asesor?`
      : `${personalizedName}no logré encontrar los detalles de tu consulta sobre ${program} en mi base de datos oficial. ¿Te gustaría que te contactemos para resolver esta duda?`
    return {
      answer,
      sources: [],
    }
  }

  return {
    answer: isUsilAdmissionsSalesQuestion(question ?? "")
      ? "Para orientarte bien, dime qué carrera te interesa y te ayudo con el siguiente paso de admisión USIL."
      : "Puedo ayudarte con admisiones USIL: carreras, modalidades, postulación, campus, financiamiento y próximos pasos. ¿Qué te gustaría revisar primero?",
    sources: [],
  }
}

export function isUsilAdmissionsSalesQuestion(question: string) {
  const normalizedQuestion = normalizeForIntent(question)

  if (!normalizedQuestion) {
    return false
  }

  return USIL_ADMISSIONS_SALES_TERMS.some((term) =>
    normalizedQuestion.includes(term)
  )
}

export function hasDisallowedUserFacingWording(answer: string) {
  const normalizedAnswer = normalizeForIntent(answer)

  return DISALLOWED_USER_FACING_PATTERNS.some((pattern) =>
    normalizedAnswer.includes(pattern)
  )
}

export function tryBuildFastGroundedAnswer(params: {
  question: string
  chunks: KnowledgeChunk[]
}): GroundedAnswer | null {
  const normalizedQuestion = normalizeForIntent(params.question)
  const answerChunks = selectAnswerChunks(params.chunks)
  const sources = toSources(answerChunks)

  if (sources.length === 0) {
    return null
  }

  if (isModalitiesQuestion(normalizedQuestion)) {
    const modalities = admissionModalitiesFromChunks(answerChunks)

    if (modalities.length > 0) {
      return {
        answer: `Según la fuente oficial de Modalidades de Admisión de USIL, estas son modalidades disponibles: ${modalities.join(", ")}. ¿Cuál es tu situación actual para orientarte con la modalidad más adecuada?`,
        sources,
      }
    }
  }

  if (isFinancialQuestion(normalizedQuestion)) {
    const sourceTitles = sources.map((source) => source.title).join(" y ")
    const asksScholarship = /\b(beca|becas)\b/.test(normalizedQuestion)

    return {
      answer: asksScholarship
        ? `Puedo orientarte con información oficial relacionada con ${sourceTitles}. Para condiciones específicas de becas, conviene validar el caso con admisiones o revisar el enlace oficial antes de tomar una decisión.`
        : `Puedo orientarte con información oficial sobre ${sourceTitles}. Para montos exactos por carrera o periodo, conviene validar el caso con admisiones o revisar el enlace oficial antes de tomar una decisión.`,
      sources,
    }
  }

  return null
}

export async function generateAdmissionsAdvisorReply(params: {
  message: string
  advisorContext: AdvisorGenerationContext
}): Promise<GroundedAnswer> {
  const openai = createOpenAIClient()
  const response = await openai.responses.create({
    model: getOpenAIAnswerModel(),
    instructions: USIL_ADMISSIONS_ADVISOR_INSTRUCTIONS,
    input: buildAdvisorInput({
      latestUserMessage: params.message,
      advisorContext: params.advisorContext,
      task: "The user is continuing an admissions conversation or sharing lead/profile data. Acknowledge what changed, use known facts, and advance qualification naturally with exactly one useful next question when appropriate. If the user asks how to enroll or postulate, first give a concrete safe next step: choose/confirm career and the applicable admission/study modality, continue through USIL admissions or an admissions advisor, and have basic personal/school information ready; if career is unknown, ask only for the career next, not career plus modality/campus/city together. Do not invent URLs, dates, prices, modality names, or guarantees.",
    }),
    max_output_tokens: 360,
  })

  const answer = response.output_text.trim()

  if (!answer || hasDisallowedUserFacingWording(answer)) {
    return buildInsufficientContextAnswer(params.message, params.advisorContext)
  }

  return {
    answer,
    sources: [],
  }
}

export async function generateContextFallbackReply(params: {
  message: string
  advisorContext: AdvisorGenerationContext
}): Promise<GroundedAnswer> {
  try {
    const openai = createOpenAIClient()
    const response = await openai.responses.create({
      model: getOpenAIAnswerModel(),
      instructions: `${USIL_ADMISSIONS_ADVISOR_INSTRUCTIONS}
No tienes contexto oficial disponible (RAG) en este turno para responder a esta pregunta factual específica del usuario.
Reconoce que no tienes el dato exacto a la mano de forma muy empática, natural y humana. ¡Evita sonar robótico y bajo ningún concepto menciones términos técnicos de IA (como base de datos, contexto proporcionado, RAG, limitaciones del sistema)!
Mantén el hilo de la conversación activo: usa los datos ya conocidos en su perfil (como su nombre y carrera de interés) si están disponibles.
Luego, de manera muy fluida y empática, ofrécele que un asesor humano se ponga en contacto con él para pasarle la información exacta, o hazle una única pregunta de cierre cálida para continuar con su admisión.`,
      input: buildAdvisorInput({
        latestUserMessage: params.message,
        advisorContext: params.advisorContext,
        task: "Acknowledge the missing fact empathetically and naturally. Propose coordinator/advisor contact or ask a next logical qualification question using the known facts.",
      }),
      max_output_tokens: 360,
    })

    const answer = response.output_text.trim()

    if (!answer || hasDisallowedUserFacingWording(answer)) {
      return buildInsufficientContextAnswer(
        params.message,
        params.advisorContext
      )
    }

    return {
      answer,
      sources: [],
    }
  } catch (error) {
    console.error("Failed to generate contextual fallback reply:", error)
    return buildInsufficientContextAnswer(params.message, params.advisorContext)
  }
}

export async function generateGroundedAnswer(params: {
  question: string
  chunks: KnowledgeChunk[]
  advisorContext: AdvisorGenerationContext
}): Promise<GroundedAnswer> {
  const openai = createOpenAIClient()
  const answerChunks = selectAnswerChunks(params.chunks)
  const sources = toSources(answerChunks)

  const response = await openai.responses.create({
    model: getOpenAIAnswerModel(),
    instructions: USIL_ADMISSIONS_ADVISOR_INSTRUCTIONS,
    input: buildAdvisorInput({
      latestUserMessage: params.question,
      advisorContext: params.advisorContext,
      task: "Answer the user's factual USIL question first using only the retrieved official context below. Then ask exactly one relevant admissions qualification question that does not repeat known facts; ask only for one missing fact, and if career is unknown prefer asking only for the career.",
      retrievedContext: formatRetrievedContext(answerChunks),
    }),
    max_output_tokens: 450,
  })

  const answer = response.output_text.trim()

  if (!answer) {
    return buildInsufficientContextAnswer(
      params.question,
      params.advisorContext
    )
  }

  if (hasDisallowedUserFacingWording(answer)) {
    return buildSourceBackedNextStepAnswer(
      params.question,
      sources,
      params.advisorContext
    )
  }

  return {
    answer,
    sources,
  }
}

function buildSourceBackedNextStepAnswer(
  question: string,
  sources: RagSource[],
  advisorContext?: AdvisorGenerationContext
): GroundedAnswer {
  const sourceTitles = sources
    .map((source) => source.title)
    .slice(0, 2)
    .join(" y ")
  const program = advisorContext?.profileFacts?.program
  const name = advisorContext?.profileFacts?.name
  const personalizedName = name ? `${name}, ` : ""

  if (program) {
    return {
      answer: sourceTitles
        ? `${personalizedName}encontré información relacionada en las páginas oficiales de ${sourceTitles}. Te sugiero revisar esos enlaces oficiales para ver el detalle exacto. Como me comentaste que te interesa la carrera de ${program}, ¿querés que coordinemos con un asesor para ayudarte con las dudas específicas?`
        : buildInsufficientContextAnswer(question, advisorContext).answer,
      sources,
    }
  }

  return {
    answer: sourceTitles
      ? `Encontré fuentes oficiales relacionadas con ${sourceTitles}. Para darte el dato exacto sin inventar condiciones, revisa los enlaces oficiales. ¿Qué carrera quieres evaluar para guiarte con el siguiente paso?`
      : buildInsufficientContextAnswer(question, advisorContext).answer,
    sources,
  }
}

export async function generateOfficialWebSearchAnswer(params: {
  question: string
  advisorContext: AdvisorGenerationContext
}): Promise<WebSearchFallbackAnswer> {
  try {
    const openai = createOpenAIClient()
    const response = await openai.responses.create({
      model: getOpenAIWebSearchModel(),
      instructions: `${USIL_ADMISSIONS_ADVISOR_INSTRUCTIONS}\nUse the web search tool only to consult official USIL pages from usil.edu.pe. Use citations from the web-search results when answering.`,
      input: buildAdvisorInput({
        latestUserMessage: params.question,
        advisorContext: params.advisorContext,
        task: "Search official USIL pages and answer the user's factual admissions question first. Then ask exactly one relevant admissions qualification question that does not repeat known facts; ask only for one missing fact, and if career is unknown prefer asking only for the career.",
      }),
      tools: [
        {
          type: "web_search",
          filters: {
            allowed_domains: [OFFICIAL_USIL_DOMAIN],
          },
          search_context_size: "low",
        },
      ],
      include: ["web_search_call.action.sources"],
      max_output_tokens: 400,
    })

    const sources = extractOfficialUrlCitations(response)
    const answer = response.output_text.trim()

    if (sources.length === 0 || !answer) {
      const fallback = await generateContextFallbackReply({
        message: params.question,
        advisorContext: params.advisorContext,
      })
      return {
        ...fallback,
        status: "no_citations",
      }
    }

    return {
      answer,
      sources,
      status: "answered",
    }
  } catch (error) {
    const message = sanitizeErrorMessage(error)

    console.error("Official USIL web search fallback failed", message)

    const fallback = await generateContextFallbackReply({
      message: params.question,
      advisorContext: params.advisorContext,
    })
    return {
      ...fallback,
      status: "failed",
      error: message,
    }
  }
}

function buildAdvisorInput(params: {
  latestUserMessage: string
  advisorContext: AdvisorGenerationContext
  task: string
  retrievedContext?: string
}) {
  const systemContext = [
    params.task,
    formatConversationState(params.advisorContext),
    formatKnownFacts(params.advisorContext.profileFacts),
    formatCurrentFacts(params.advisorContext.currentFacts),
    formatMissingFacts(params.advisorContext.profileFacts),
    params.retrievedContext
      ? `Official USIL context available for this answer:\n${params.retrievedContext}`
      : "No official context was supplied for this turn; do not invent official facts.",
  ].join("\n\n")

  return [
    {
      role: "system" as const,
      content: systemContext,
    },
    ...params.advisorContext.history
      .slice(-MAX_ADVISOR_HISTORY_MESSAGES)
      .filter(
        (message) => message.role === "user" || message.role === "assistant"
      )
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: trimConversationMessage(message.content),
      })),
    {
      role: "user" as const,
      content: params.latestUserMessage,
    },
  ]
}

function formatConversationState(context: AdvisorGenerationContext) {
  const state = {
    lead: compactStateSection({
      name: context.profileFacts.name,
      lastname: context.profileFacts.lastName,
      age: context.profileFacts.age,
      phone: context.profileFacts.phone,
      email: context.profileFacts.email,
    }),
    education: compactStateSection({
      status: context.profileFacts.currentStatus,
      school:
        context.profileFacts.school ?? context.profileFacts.originInstitution,
      graduation_year: context.profileFacts.graduationYear,
      current_university: context.profileFacts.currentUniversity,
    }),
    interest: compactStateSection({
      faculty: context.profileFacts.faculty,
      career: context.profileFacts.program,
      campus: context.profileFacts.campus,
      modality: context.profileFacts.modality,
    }),
    location: compactStateSection({
      country: context.profileFacts.country,
      city: context.profileFacts.city,
    }),
    qualification: compactStateSection({
      interest_level: context.profileFacts.interestLevel,
      budget: context.profileFacts.budget,
      urgency: context.profileFacts.urgency,
      objections: context.profileFacts.objections,
      score: context.leadScore?.score?.toString(),
      category: context.leadScore?.category,
    }),
    history: {
      facts: formatLeadFacts(context.profileFacts).map((fact) =>
        fact.replace(/^-\s*/, "")
      ),
      answered_questions: inferAnsweredTopics(context.history),
    },
    next_goal: inferNextGoal(context.profileFacts),
  }

  return `Structured conversation state. Treat this as internal state, never expose it verbatim:\n${JSON.stringify(state, null, 2)}`
}

function compactStateSection(section: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(section).flatMap(([key, value]) => {
      const normalizedValue = value?.trim()

      return normalizedValue ? [[key, normalizedValue]] : []
    })
  )
}

function inferNextGoal(profileFacts: LeadFields) {
  const nextBestFact = missingProfileFields(profileFacts)[0]

  return nextBestFact
    ? `Advance naturally by learning: ${PROFILE_FIELD_LABELS[nextBestFact]}`
    : "Guide the prospect toward the next admissions/conversion step."
}

function inferAnsweredTopics(history: RecentConversationMessage[]) {
  const text = normalizeForIntent(
    history
      .filter(
        (message) => message.role === "user" || message.role === "assistant"
      )
      .map((message) => message.content)
      .join(" ")
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

function formatRetrievedContext(chunks: KnowledgeChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `Source ${index + 1}\nTitle: ${chunk.sourceTitle}\nURL: ${chunk.sourceUrl}\nChunk ID: ${chunk.id}\nRelevance: ${chunk.score.toFixed(3)}\nContent:\n${trimContext(chunk.content)}`
    )
    .join("\n\n---\n\n")
}

function formatKnownFacts(profileFacts: LeadFields) {
  const facts = formatLeadFacts(profileFacts)

  return facts.length > 0
    ? `Known lead/profile facts. Use these naturally and do not ask for them again:\n${facts.join("\n")}`
    : "Known lead/profile facts: none yet."
}

function formatCurrentFacts(currentFacts?: LeadFields) {
  const facts = formatLeadFacts(currentFacts ?? {})

  return facts.length > 0
    ? `New facts from the latest user message:\n${facts.join("\n")}`
    : "New facts from the latest user message: none."
}

function formatMissingFacts(profileFacts: LeadFields) {
  const missingFacts = missingProfileFields(profileFacts).map(
    (field) => PROFILE_FIELD_LABELS[field]
  )
  const nextBestFact = missingFacts[0]

  return nextBestFact
    ? `Useful missing admissions facts, in priority order: ${missingFacts.join(", ")}. Prefer asking only for: ${nextBestFact}.`
    : "The core admissions profile is already well covered. Ask a next-step question only if it helps the student advance."
}

function missingProfileFields(profileFacts: LeadFields) {
  return ADMISSIONS_PROFILE_PRIORITY.filter((field) => {
    if (field === "school" || field === "originInstitution") {
      return !(
        profileFacts.school?.trim() ||
        profileFacts.originInstitution?.trim() ||
        profileFacts.currentUniversity?.trim()
      )
    }

    return !profileFacts[field]?.trim()
  })
}

function formatLeadFacts(fields: LeadFields) {
  return PROFILE_FIELD_ORDER.flatMap((field) => {
    const value = fields[field]?.trim()

    if (
      field === "originInstitution" &&
      value &&
      (value === fields.school?.trim() ||
        value === fields.currentUniversity?.trim())
    ) {
      return []
    }

    return value ? [`- ${PROFILE_FIELD_LABELS[field]}: ${value}`] : []
  })
}

function trimConversationMessage(content: string) {
  return content.length > 900 ? `${content.slice(0, 900).trim()}…` : content
}

function selectAnswerChunks(chunks: KnowledgeChunk[]) {
  const seenUrls = new Set<string>()

  return chunks
    .flatMap((chunk) => {
      if (seenUrls.has(chunk.sourceUrl)) {
        return []
      }

      seenUrls.add(chunk.sourceUrl)
      return [chunk]
    })
    .slice(0, MAX_ANSWER_CHUNKS)
}

function admissionModalitiesFromChunks(chunks: KnowledgeChunk[]) {
  const context = normalizeForIntent(
    chunks.map((chunk) => chunk.content).join(" ")
  )

  return ADMISSION_MODALITIES.filter((modality) =>
    context.includes(normalizeForIntent(modality))
  )
}

function isModalitiesQuestion(question: string) {
  return /\b(modalidad|modalidades|admision|ingreso|postulacion)\b/.test(
    question
  )
}

function isFinancialQuestion(question: string) {
  return /\b(beca|becas|financiamiento|financiar|credito|creditos|pension|pensiones|costo|costos|tarifa|tarifas|cobranza|cobranzas)\b/.test(
    question
  )
}

function normalizeForIntent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function trimContext(content: string) {
  if (content.length <= MAX_CONTEXT_CHARS_PER_CHUNK) {
    return content
  }

  return `${content.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK).trim()}…`
}

function extractOfficialUrlCitations(response: { output?: unknown }) {
  const output = Array.isArray(response.output) ? response.output : []
  const citations = output.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    if (item.type === "web_search_call") {
      const action = isRecord(item.action) ? item.action : null
      const sources = Array.isArray(action?.sources) ? action.sources : []

      return sources.flatMap((source) => {
        if (!isRecord(source)) {
          return []
        }

        if (
          source.type !== "url" ||
          typeof source.url !== "string" ||
          !isOfficialUsilUrl(source.url)
        ) {
          return []
        }

        return [
          {
            title: titleFromOfficialUrl(source.url),
            url: source.url,
          },
        ]
      })
    }

    if (item.type !== "message") {
      return []
    }

    const contentItems = Array.isArray(item.content) ? item.content : []

    return (
      contentItems.flatMap((content) => {
        if (!isRecord(content)) {
          return []
        }

        if (
          content.type !== "output_text" ||
          !Array.isArray(content.annotations)
        ) {
          return []
        }

        return content.annotations.flatMap((annotation) => {
          if (
            !isUrlCitation(annotation) ||
            !isOfficialUsilUrl(annotation.url)
          ) {
            return []
          }

          return [annotation]
        })
      }) ?? []
    )
  })

  const seenUrls = new Set<string>()

  return (citations ?? []).flatMap<RagSource>((citation, index) => {
    if (seenUrls.has(citation.url)) {
      return []
    }

    seenUrls.add(citation.url)

    return [
      {
        title: citation.title || citation.url,
        url: citation.url,
        chunkId: `web:${index}:${shortHash(citation.url)}`,
        score: 1,
      },
    ]
  })
}

function isUrlCitation(
  value: unknown
): value is { title: string; url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "url_citation" &&
    "url" in value &&
    typeof value.url === "string" &&
    "title" in value &&
    typeof value.title === "string"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isOfficialUsilUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()

    return (
      hostname === OFFICIAL_USIL_DOMAIN ||
      hostname.endsWith(`.${OFFICIAL_USIL_DOMAIN}`)
    )
  } catch {
    return false
  }
}

function titleFromOfficialUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const slug = parsedUrl.pathname.split("/").filter(Boolean).at(-1)

    if (!slug) {
      return "Fuente oficial USIL"
    }

    return `USIL · ${slug.replace(/-/g, " ")}`
  } catch {
    return "Fuente oficial USIL"
  }
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12)
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 240)
}

const ADMISSION_MODALITIES = [
  "Primeros puestos",
  "Quinto Superior",
  "Tercio Superior",
  "Deportista Destacado",
  "Deportista calificado o de alta competencia",
  "Sistema de Progresión Universitaria - SPU",
  "Admisión Destacada",
  "Regular",
  "Bachillerato Internacional",
  "Traslado Externo de Institutos",
  "Traslado Externo de Universidades",
  "Traslado Externo",
]

const USIL_ADMISSIONS_SALES_TERMS = [
  "usil",
  "admision",
  "admisiones",
  "postular",
  "postulacion",
  "inscripcion",
  "carrera",
  "carreras",
  "programa",
  "programas",
  "pregrado",
  "facultad",
  "campus",
  "modalidad",
  "modalidades",
  "horario",
  "horarios",
  "beca",
  "becas",
  "financiamiento",
  "credito",
  "creditos",
  "pension",
  "pensiones",
  "costo",
  "costos",
  "tarifa",
  "tarifas",
  "matricula",
  "historia",
  "fundacion",
  "fundada",
  "creacion",
  "creada",
  "edad",
  "antiguedad",
  "universidad",
  "san ignacio",
  "asesor",
  "asesoria",
]

const DISALLOWED_USER_FACING_PATTERNS = [
  "no tengo una fuente verificada",
  "not enough verified",
  "knowledge base",
  "base de conocimiento",
  "base actual",
  "base verificada",
  "verified source",
  "seed",
  "semilla",
  "contexto proporcionado",
  "provided context",
  "retrieved context",
]
