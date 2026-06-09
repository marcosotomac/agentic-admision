import OpenAI from "openai"

import { getServerEnv } from "./env"

export function createOpenAIClient() {
  const env = getServerEnv()

  return new OpenAI({
    apiKey: env.openaiApiKey,
  })
}

export function getOpenAIEmbeddingModel() {
  return getServerEnv().openaiEmbeddingModel
}

export function getOpenAIAnswerModel() {
  return getServerEnv().openaiAnswerModel
}

export function getOpenAIWebSearchModel() {
  return getServerEnv().openaiWebSearchModel
}
