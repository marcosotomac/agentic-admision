import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"

const require = createRequire(import.meta.url)
const maxCliUrls = 150

const usage = `Usage:
  pnpm ingest:usil https://www.usil.edu.pe/... [https://admision.usil.edu.pe/...]
  pnpm ingest:usil --file scripts/usil-seed-urls.txt
  pnpm ingest:usil --file scripts/usil-seed-urls.txt https://www.usil.edu.pe/pregrado

Options:
  --file <path>  Read newline-delimited seed URLs. Blank lines and lines starting with # are ignored.
  -h, --help     Show this help.

Only explicit allowlisted USIL URLs are accepted. This command does not crawl links.
Environment credentials are read at runtime through the existing server env module; do not
pass secrets as CLI arguments.`

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2))

  if (parsedArgs.help) {
    console.log(usage)
    process.exit(0)
  }

  const fileUrls = await readSeedFileUrls(parsedArgs.file)
  const urls = Array.from(new Set([...fileUrls, ...parsedArgs.urls]))

  if (urls.length === 0) {
    console.log(usage)
    process.exit(1)
  }

  if (urls.length > maxCliUrls) {
    throw new Error(
      `Refusing to ingest ${urls.length} URLs at once. Limit: ${maxCliUrls}.`
    )
  }

  loadRuntimeEnv()

  const [{ createServerSupabaseClient }, { ingestUsilUrls }] =
    await Promise.all([
      import("@/lib/server/supabase"),
      import("@/lib/rag/ingestion"),
    ])

  const supabase = createServerSupabaseClient()
  const results = await ingestUsilUrls({
    supabase,
    urls,
    metadata: {
      runner: "scripts/ingest-usil.ts",
    },
  })

  console.table(
    results.map((result) => ({
      status: result.status,
      url: result.url,
      detail:
        "reason" in result ? result.reason : `${result.chunkCount} chunks`,
    }))
  )

  const failed = results.some((result) => result.status === "rejected")
  process.exit(failed ? 1 : 0)
}

function parseArgs(args: string[]) {
  const urls: string[] = []
  let file: string | undefined
  let help = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (!arg || arg === "--") {
      continue
    }

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--file") {
      const nextArg = args[index + 1]

      if (!nextArg) {
        throw new Error("Missing path after --file.")
      }

      file = nextArg
      index += 1
      continue
    }

    if (arg.startsWith("--file=")) {
      file = arg.slice("--file=".length)
      continue
    }

    urls.push(arg)
  }

  return { file, help, urls }
}

async function readSeedFileUrls(file?: string) {
  if (!file) {
    return []
  }

  const content = await readFile(resolve(process.cwd(), file), "utf8")
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
}

function loadRuntimeEnv() {
  const { loadEnvConfig } = require("@next/env") as typeof import("@next/env")
  const isDev = process.env.NODE_ENV !== "production"

  loadEnvConfig(process.cwd(), isDev)
  loadEnvConfig(dirname(process.cwd()), isDev, undefined, true)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
