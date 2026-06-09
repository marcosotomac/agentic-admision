import { ReactNode, memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BotAvatar } from "./BotAvatar"
import { PendingMessage } from "./PendingMessage"
import { detectCurriculumCareer } from "@/lib/chat/utils"
import type { ChatMessage, RagSource } from "@/lib/types/chat"

export function Transcript({
  messages,
  onOpenCurriculum,
  currentProgram,
}: {
  messages: ChatMessage[]
  onOpenCurriculum: (career: string) => void
  currentProgram?: string
}) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onOpenCurriculum={onOpenCurriculum}
          currentProgram={currentProgram}
        />
      ))}
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({
  message,
  onOpenCurriculum,
  currentProgram,
}: {
  message: ChatMessage
  onOpenCurriculum: (career: string) => void
  currentProgram?: string
}) {
  const isUser = message.role === "user"
  const bodyText = typeof message.body === "string" ? message.body : ""
  const detectedCareer =
    !isUser && !message.pending && bodyText
      ? detectCurriculumCareer(bodyText, currentProgram)
      : null

  return (
    <article
      className={`flex items-start gap-3.5 ${
        isUser
          ? "animate-user-reveal justify-end"
          : "animate-bot-reveal justify-start"
      }`}
    >
      {!isUser ? <BotAvatar /> : null}
      <div
        className={`flex max-w-full flex-col gap-1.5 ${
          isUser
            ? "max-w-[85%] items-end md:max-w-[70%]"
            : "max-w-[85%] items-start md:max-w-[70%]"
        }`}
      >
        <div
          className={`text-sm leading-relaxed md:text-[0.95rem] ${
            isUser
              ? "rounded-2xl rounded-br-sm bg-usil-navy px-4.5 py-2.5 text-white shadow-sm"
              : `px-0 py-1 text-slate-800 ${message.error ? "text-red-600" : ""}`
          }`}
        >
          {message.pending ? (
            <PendingMessage />
          ) : typeof message.body === "string" ? (
            renderMarkdown(message.body)
          ) : (
            message.body
          )}
        </div>

        {detectedCareer && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenCurriculum(detectedCareer)}
            className="mt-2 flex items-center gap-2 rounded-xl border-blue-200 bg-blue-50/60 px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-sm transition-all hover:bg-blue-100/80 active:scale-95"
          >
            <span>📊 Ver Malla Curricular Interactiva</span>
          </Button>
        )}

        {!isUser && message.sources?.length ? (
          <SourceList sources={message.sources} />
        ) : null}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span>{message.time}</span>
          {message.status === "sent" ? (
            <span aria-label="Mensaje enviado" className="text-blue-600">
              ✓✓
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
})

function renderMarkdown(text: string): ReactNode {
  const blocks = text.split("\n")
  return (
    <>
      {blocks.map((block, bIdx) => {
        let line = block
        let isBullet = false
        if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
          isBullet = true
          line = line.replace(/^\s*[-*]\s+/, "")
        }

        const parts = parseBoldText(line)

        return (
          <span
            key={bIdx}
            className={`mb-1.5 block last:mb-0 ${isBullet ? "pl-4 indent-[-0.75rem]" : ""}`}
          >
            {isBullet ? "• " : null}
            {parts}
          </span>
        )
      })}
    </>
  )
}

function parseBoldText(text: string): ReactNode[] {
  const regex = /\*\*([^*]+)\*\*/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex))
    }
    parts.push(
      <strong key={matchIndex} className="font-bold">
        {match[1]}
      </strong>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

function SourceList({ sources }: { sources: RagSource[] }) {
  return (
    <div
      className="flex max-w-full flex-wrap gap-1.5 pt-1"
      aria-label="Fuentes verificadas"
    >
      {sources.map((source, index) => (
        <Badge
          key={`${source.chunkId}:${source.url}`}
          variant="outline"
          className="animate-slide-in max-w-full rounded-full border-blue-100 bg-blue-50/80 px-2 py-1 text-[11px] font-semibold text-blue-700"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="max-w-[14rem] truncate hover:underline"
            title={`${source.title} · ${(source.score * 100).toFixed(0)}%`}
          >
            {source.title}
          </a>
        </Badge>
      ))}
    </div>
  )
}
