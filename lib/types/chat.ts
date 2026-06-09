import type { ReactNode } from "react"
import type { LeadFields } from "../leads/scoring"

export type IconName =
  | "admission"
  | "arrow-right"
  | "bank"
  | "briefcase"
  | "calendar"
  | "chat"
  | "code"
  | "dollar"
  | "heart"
  | "laptop"
  | "megaphone"
  | "moon"
  | "palette"
  | "paperclip"
  | "refresh"
  | "scale"
  | "send"
  | "sparkles"
  | "sun"
  | "trophy"
  | "university"
  | "menu"
  | "x"

export type ChatMessage = {
  id: string
  role: "bot" | "user"
  body: ReactNode
  time: string
  status?: "sent"
  sources?: RagSource[]
  pending?: boolean
  error?: boolean
}

export type RagSource = {
  title: string
  url: string
  chunkId: string
  score: number
}

export type ChatApiResponse = {
  answer: string
  sources: RagSource[]
  cache: "hit" | "miss"
  profileFields?: LeadFields
}

export type Category = {
  title: string
  count: string
  tone: "blue" | "green" | "violet" | "orange" | "pink"
  icon: IconName
}

export type QuickChip = {
  label: string
  icon: IconName
}