import { z } from "zod"

const serverEnvSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseServiceRoleKey: z.string().min(1),
  openaiApiKey: z.string().min(1),
  openaiEmbeddingModel: z.string().min(1).default("text-embedding-3-small"),
  openaiAnswerModel: z.string().min(1).default("gpt-4.1-mini"),
  openaiWebSearchModel: z.string().min(1).default("gpt-5-mini"),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cachedServerEnv: ServerEnv | undefined

export class ServerEnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ServerEnvError"
  }
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv
  }

  const parsed = serverEnvSchema.safeParse({
    supabaseUrl:
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL,
    openaiAnswerModel: process.env.OPENAI_ANSWER_MODEL,
    openaiWebSearchModel: process.env.OPENAI_WEB_SEARCH_MODEL,
  })

  if (!parsed.success) {
    const missingOrInvalid = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ")

    throw new ServerEnvError(
      `Server environment is not configured correctly: ${missingOrInvalid}`
    )
  }

  cachedServerEnv = parsed.data
  return cachedServerEnv
}
