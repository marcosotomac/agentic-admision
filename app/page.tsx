"use client"

import { useState, useEffect } from "react"
import type { LeadFields } from "@/lib/leads/scoring"
import CurriculumModal from "@/components/CurriculumModal"
import {
  staticCurriculums,
  type CurriculumData,
} from "@/lib/rag/curriculumData"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"

import type { ChatMessage, Category, QuickChip } from "@/lib/types/chat"

import {
  formatMessageTime,
  createSessionId,
  createMessageId,
  isChatApiResponse,
  getResponseError,
} from "@/lib/chat/utils"

import { ChatHeader } from "@/components/chat/ChatHeader"
import { Transcript } from "@/components/chat/Transcript"
import { CategoryGrid } from "@/components/chat/CategoryGrid"
import { Composer } from "@/components/chat/Composer"
import {
  LeadProfilePanel,
  LeadProfilePanelContent,
} from "@/components/chat/LeadProfilePanel"
import { DecorativeIcon } from "@/components/chat/ChatIcons"
import { careersByCategory } from "@/lib/constants/careers"

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "bot",
    time: "--:--",
    body: (
      <>
        <p>
          ¡Hola! 👋 Soy <strong>USILBot</strong>, tu asesor de admisión.
        </p>
        <p>
          Estoy aquí para ayudarte a descubrir todo lo que la USIL tiene para
          ti.
        </p>
        <p>¿En qué puedo ayudarte hoy?</p>
      </>
    ),
  },
]

const DEFAULT_QUICK_CHIPS: QuickChip[] = [
  { label: "Costos y pensiones", icon: "dollar" },
  { label: "Fechas de admisión", icon: "calendar" },
  { label: "Becas disponibles", icon: "trophy" },
  { label: "Modalidades", icon: "laptop" },
]

export default function Page() {
  const [animate, setAnimate] = useState(false)
  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sessionId] = useState(() => createSessionId())
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [leadFields, setLeadFields] = useState<LeadFields>({})
  const [showDesktopProfile, setShowDesktopProfile] = useState(true)
  const [showMobileProfile, setShowMobileProfile] = useState(false)
  const [showMobileCareers, setShowMobileCareers] = useState(false)
  const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(
    null
  )
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false)
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false)

  async function handleOpenCurriculum(careerName: string) {
    if (!careerName) return

    const staticData = staticCurriculums[careerName]
    if (staticData) {
      setCurriculumData(staticData)
      setIsCurriculumOpen(true)
      return
    }

    setIsLoadingCurriculum(true)
    try {
      const res = await fetch(
        `/api/curriculum?career=${encodeURIComponent(careerName)}`
      )
      if (!res.ok) {
        throw new Error("No se pudo cargar la malla curricular interactiva.")
      }
      const data = await res.json()
      setCurriculumData(data)
      setIsCurriculumOpen(true)
    } catch (err) {
      console.error(err)
      alert(
        `No pudimos cargar la malla interactiva para "${careerName}". Igualmente, podés preguntarme sobre los cursos en el chat.`
      )
    } finally {
      setIsLoadingCurriculum(false)
    }
  }

  function handleStartAdmission(career: string) {
    setIsCurriculumOpen(false)
    setLeadFields((prev) => ({ ...prev, program: career }))
    submitMessage(`Quiero iniciar mi postulación a la carrera de ${career}`)
  }

  function toggleProfile() {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setShowMobileProfile((prev) => !prev)
    } else {
      setShowDesktopProfile((prev) => !prev)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimate(true)
    }, 200)

    setChatMessages((prev) =>
      prev.map((msg) =>
        msg.id === "welcome" ? { ...msg, time: formatMessageTime() } : msg
      )
    )

    return () => clearTimeout(timer)
  }, [])

  function getDynamicQuickChips(): QuickChip[] {
    if (leadFields.program) {
      return [
        { label: `Ver malla de ${leadFields.program}`, icon: "admission" },
        { label: `Pensión en ${leadFields.program}`, icon: "dollar" },
        { label: `Becas para ${leadFields.program}`, icon: "trophy" },
        { label: `Requisitos para ${leadFields.program}`, icon: "laptop" },
      ]
    }
    return DEFAULT_QUICK_CHIPS
  }

  async function typeMessageAndSubmit(chipLabel: string) {
    if (isSending || isTyping) {
      return
    }

    if (chipLabel.startsWith("Ver malla de ")) {
      const careerName =
        leadFields.program || chipLabel.replace("Ver malla de ", "")
      handleOpenCurriculum(careerName)
      return
    }

    let targetText = ""
    if (chipLabel.startsWith("Pensión en ")) {
      targetText = `Me gustaría saber sobre la pensión y costos para ${leadFields.program}`
    } else if (chipLabel.startsWith("Becas para ")) {
      targetText = `Me gustaría saber sobre las becas disponibles para ${leadFields.program}`
    } else if (chipLabel.startsWith("Requisitos para ")) {
      targetText = `Me gustaría saber sobre los requisitos de admisión para ${leadFields.program}`
    } else {
      switch (chipLabel) {
        case "Costos y pensiones":
          targetText =
            "Me gustaría saber información acerca de los costos y pensiones de USIL"
          break
        case "Fechas de admisión":
          targetText =
            "Me gustaría saber información acerca de las fechas de admisión"
          break
        case "Becas disponibles":
          targetText =
            "Me gustaría saber información acerca de las becas disponibles"
          break
        case "Modalidades":
          targetText =
            "Me gustaría saber información acerca de las modalidades de admisión"
          break
        default:
          targetText = `Me gustaría saber información acerca de ${chipLabel}`
      }
    }

    setIsTyping(true)
    setInputValue("")

    let currentText = ""
    let index = 0

    const typingInterval = setInterval(() => {
      if (index < targetText.length) {
        currentText += targetText[index]
        setInputValue(currentText)
        index++
      } else {
        clearInterval(typingInterval)
        setTimeout(() => {
          setIsTyping(false)
          submitMessage(targetText)
        }, 250)
      }
    }, 25)
  }

  async function submitMessage(messageText: string) {
    const trimmedMessage = messageText.trim()

    if (!trimmedMessage || isSending) {
      return
    }

    const pendingId = createMessageId()

    setIsSending(true)
    setInputValue("")
    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: createMessageId(),
        role: "user",
        body: trimmedMessage,
        time: formatMessageTime(),
        status: "sent",
      },
      {
        id: pendingId,
        role: "bot",
        body: "Buscando información oficial de USIL...",
        time: formatMessageTime(),
        pending: true,
      },
    ])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: trimmedMessage,
        }),
      })

      const data: unknown = await response.json().catch(() => null)

      if (!response.ok || !isChatApiResponse(data)) {
        throw new Error(getResponseError(data))
      }

      if (data.profileFields) {
        setLeadFields((prev) => ({ ...prev, ...data.profileFields }))
      }

      setChatMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === pendingId
            ? {
                id: pendingId,
                role: "bot",
                body: data.answer,
                time: formatMessageTime(),
                sources: data.sources,
              }
            : message
        )
      )
    } catch (error) {
      setChatMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === pendingId
            ? {
                id: pendingId,
                role: "bot",
                body:
                  error instanceof Error
                    ? error.message
                    : "No pude completar la consulta en este momento. Intentá nuevamente.",
                time: formatMessageTime(),
                error: true,
              }
            : message
        )
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <TooltipProvider>
      <main className="ambient-bg flex h-svh w-screen items-center justify-center text-slate-950 md:p-6">
        <Card
          className={`page-entrance md:glass-card mx-auto flex h-full w-full flex-row overflow-hidden bg-white py-0 md:h-[88svh] md:max-w-[72rem] md:rounded-[2rem] md:border md:border-slate-200/40 md:shadow-[0_24px_60px_rgba(7,37,109,0.08)] ${
            animate ? "page-entrance-active" : ""
          }`}
        >
          <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
            <ChatHeader
              onToggleProfile={toggleProfile}
              leadFields={leadFields}
              showDesktopProfile={showDesktopProfile}
              showMobileProfile={showMobileProfile}
            />
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-4 px-4 py-4 sm:px-6 md:px-8 md:py-6">
                <Transcript
                  messages={chatMessages}
                  onOpenCurriculum={handleOpenCurriculum}
                  currentProgram={leadFields.program}
                />
                <CategoryGrid
                  className="hidden md:block"
                  onSelectCategory={setActiveCategory}
                  onShowAllCareers={() =>
                    submitMessage(
                      "Quiero conocer todas las carreras disponibles en USIL"
                    )
                  }
                />
              </div>
            </ScrollArea>
            <Composer
              inputValue={inputValue}
              isSending={isSending || isTyping}
              onInputChange={setInputValue}
              onOpenCareers={() => setShowMobileCareers(true)}
              onQuickPrompt={typeMessageAndSubmit}
              onSubmit={submitMessage}
              quickChips={getDynamicQuickChips()}
            />
          </section>

          <div
            className={`hidden overflow-hidden border-l border-slate-100 bg-slate-50/20 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:block ${
              showDesktopProfile
                ? "w-80 opacity-100"
                : "w-0 border-l-transparent opacity-0"
            }`}
          >
            <LeadProfilePanel
              leadFields={leadFields}
              className="w-80 shrink-0"
            />
          </div>
        </Card>
      </main>

      {/* Mobile drawer for Lead Profile */}
      {showMobileProfile && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setShowMobileProfile(false)}
        >
          <div
            className="animate-drawer-slide-up fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[2rem] border-t border-slate-200/50 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-slate-800">
                  Tu Ficha de Admisión
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileProfile(false)}
                className="size-8 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900"
              >
                <DecorativeIcon name="x" className="size-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 overflow-y-auto p-6">
              <LeadProfilePanelContent leadFields={leadFields} />
            </ScrollArea>
          </div>
        </div>
      )}

      {showMobileCareers && (
        <div
          className="animate-backdrop-fade fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setShowMobileCareers(false)}
        >
          <div
            className="animate-drawer-slide-up fixed inset-x-0 bottom-0 z-50 flex max-h-[86vh] flex-col rounded-t-[2rem] border-t border-slate-200/50 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <DecorativeIcon name="briefcase" className="size-4.5" />
                </span>
                <div>
                  <span className="block text-sm font-bold text-slate-800">
                    Carreras USIL
                  </span>
                  <span className="block text-xs font-medium text-slate-400">
                    Elige un área académica
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar carreras"
                onClick={() => setShowMobileCareers(false)}
                className="size-8 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900"
              >
                <DecorativeIcon name="x" className="size-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 overflow-y-auto p-4">
              <CategoryGrid
                onSelectCategory={(category) => {
                  setShowMobileCareers(false)
                  setActiveCategory(category)
                }}
                onShowAllCareers={() => {
                  setShowMobileCareers(false)
                  submitMessage(
                    "Quiero conocer todas las carreras disponibles en USIL"
                  )
                }}
              />
            </ScrollArea>
          </div>
        </div>
      )}

      {activeCategory ? (
        <div
          className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md"
          onClick={() => setActiveCategory(null)}
        >
          <div
            className="glass-card animate-modal-scale relative flex w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-slate-200/50 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100/80 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-11 items-center justify-center rounded-xl ring-4 transition-all duration-200 ${
                    activeCategory.tone === "blue"
                      ? "bg-blue-50 text-blue-700 ring-blue-100/50"
                      : activeCategory.tone === "green"
                        ? "bg-emerald-50 text-emerald-600 ring-emerald-100/50"
                        : activeCategory.tone === "violet"
                          ? "bg-indigo-50 text-indigo-600 ring-indigo-100/50"
                          : activeCategory.tone === "orange"
                            ? "bg-orange-50 text-orange-500 ring-orange-100/50"
                            : "bg-fuchsia-50 text-fuchsia-500 ring-fuchsia-100/50"
                  }`}
                >
                  <DecorativeIcon
                    name={activeCategory.icon}
                    className="size-5.5"
                  />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-800 sm:text-lg">
                    {activeCategory.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Selecciona una carrera para iniciar admisión
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar"
                onClick={() => setActiveCategory(null)}
                className="size-8 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
              >
                <DecorativeIcon name="x" className="size-4" />
              </Button>
            </div>

            <ScrollArea className="mt-4 max-h-[45vh] overflow-y-auto pr-1">
              <div className="flex flex-col gap-2 py-1">
                {(careersByCategory[activeCategory.title] ?? []).map(
                  (career) => (
                    <button
                      key={career}
                      type="button"
                      onClick={() => {
                        submitMessage(`Me interesa la carrera de ${career}`)
                        setActiveCategory(null)
                      }}
                      className={`group flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3.5 text-left text-xs font-semibold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] sm:text-sm ${
                        activeCategory.tone === "blue"
                          ? "hover:border-blue-200 hover:bg-blue-50/40 hover:text-blue-900"
                          : activeCategory.tone === "green"
                            ? "hover:border-emerald-200 hover:bg-emerald-50/40 hover:text-emerald-900"
                            : activeCategory.tone === "violet"
                              ? "hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-900"
                              : activeCategory.tone === "orange"
                                ? "hover:border-orange-200 hover:bg-orange-50/40 hover:text-orange-900"
                                : "hover:border-fuchsia-200 hover:bg-fuchsia-50/40 hover:text-fuchsia-900"
                      }`}
                    >
                      <span>{career}</span>
                      <span
                        className={`text-slate-400 transition-all duration-300 group-hover:translate-x-0.5 ${
                          activeCategory.tone === "blue"
                            ? "group-hover:text-blue-600"
                            : activeCategory.tone === "green"
                              ? "group-hover:text-emerald-600"
                              : activeCategory.tone === "violet"
                                ? "group-hover:text-indigo-600"
                                : activeCategory.tone === "orange"
                                  ? "group-hover:text-orange-600"
                                  : "group-hover:text-fuchsia-600"
                        }`}
                      >
                        ›
                      </span>
                    </button>
                  )
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : null}

      {isCurriculumOpen && curriculumData && (
        <CurriculumModal
          data={curriculumData}
          onClose={() => setIsCurriculumOpen(false)}
          onStartAdmission={handleStartAdmission}
        />
      )}

      {isLoadingCurriculum && (
        <div className="animate-backdrop-fade fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
          <div className="glass-card flex flex-col items-center gap-3.5 rounded-[2rem] border border-slate-200/50 p-6 shadow-2xl">
            <div className="size-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#07256d]" />
            <p className="text-xs font-bold text-slate-800">
              Estructurando malla interactiva...
            </p>
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
