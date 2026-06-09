import { createHash } from "node:crypto"

import {
  createOpenAIClient,
  getOpenAIEmbeddingModel,
} from "@/lib/server/openai"

import { EMBEDDING_DIMENSIONS } from "./types"

export function normalizeQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").toLowerCase()
}

export function buildRetrievalQuery(normalizedQuestion: string) {
  const expansions = USIL_QUERY_EXPANSIONS.flatMap((expansion) =>
    expansion.pattern.test(normalizedQuestion) ? [expansion.text] : []
  )

  if (expansions.length === 0) {
    return normalizedQuestion
  }

  return [normalizedQuestion, ...new Set(expansions)].join("\n")
}

export function createQuestionChecksum(normalizedQuestion: string) {
  return createHash("sha256").update(normalizedQuestion).digest("hex")
}

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`
}

export async function createQuestionEmbedding(question: string) {
  const normalizedQuestion = normalizeQuestion(question)
  const openai = createOpenAIClient()

  const response = await openai.embeddings.create({
    model: getOpenAIEmbeddingModel(),
    input: buildRetrievalQuery(normalizedQuestion),
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const embedding = response.data[0]?.embedding

  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding provider returned an invalid vector dimension for ${getOpenAIEmbeddingModel()}.`
    )
  }

  return {
    normalizedQuestion,
    checksum: createQuestionChecksum(normalizedQuestion),
    embedding,
  }
}

const USIL_QUERY_EXPANSIONS = [
  {
    pattern:
      /\b(carrera|carreras|programa|programas|pregrado|facultad|facultades|estudiar)\b/,
    text: "USIL pregrado carreras universitarias programas académicos facultades ingeniería ciencias empresariales salud administración marketing medicina psicología modalidades de estudio",
  },
  {
    pattern:
      /\b(admision|admisión|modalidad|modalidades|ingreso|postular|postulacion|postulación|inscripcion|inscripción|requisito|requisitos)\b/,
    text: "USIL modalidades de admisión pregrado requisitos ingreso postulación primeros puestos tercio superior quinto superior traslado deportista destacado",
  },
  {
    pattern:
      /\b(beca|becas|financiamiento|financiar|credito|crédito|creditos|créditos|pension|pensión|pensiones|costo|costos|tarifa|tarifas|cobranza|cobranzas)\b/,
    text: "USIL becas financiamiento créditos cobranzas pensiones tarifas costos convenio apoyo económico admisión programas de financiamiento",
  },
  {
    pattern:
      /\b(fundacion|fundación|fundada|creacion|creación|creada|historia|edad|antiguedad|antigüedad|universidad|san ignacio)\b/,
    text: "USIL historia institucional fundación creación Universidad San Ignacio de Loyola años de trayectoria institucional Perú",
  },
]
