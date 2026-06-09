import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { DecorativeIcon } from "./ChatIcons"
import { CircularProgress } from "./CircularProgress"
import { countFilledFields, KEY_FIELDS } from "@/lib/chat/utils"
import type { LeadFields } from "@/lib/leads/scoring"
import type { IconName } from "@/lib/types/chat"

export function LeadProfilePanel({
  leadFields,
  className,
}: {
  leadFields: LeadFields
  className?: string
}) {
  return (
    <aside
      className={`flex h-full flex-col gap-6 overflow-hidden p-6 ${className || ""}`}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2">
        <div className="size-2.5 animate-pulse rounded-full bg-emerald-500" />
        <h3 className="text-sm font-bold tracking-tight text-slate-800 uppercase">
          Ficha de Admisión
        </h3>
      </div>
      <ScrollArea className="-mx-2 flex-1 px-2">
        <LeadProfilePanelContent leadFields={leadFields} />
      </ScrollArea>
    </aside>
  )
}

export function LeadProfilePanelContent({
  leadFields,
}: {
  leadFields: LeadFields
}) {
  const filledCount = countFilledFields(leadFields)
  const percentage = (filledCount / 6) * 100
  const isComplete = filledCount === 6

  const fieldLabels: Record<
    (typeof KEY_FIELDS)[number],
    { label: string; placeholder: string; icon: IconName }
  > = {
    name: {
      label: "Nombre",
      placeholder: "Por completar...",
      icon: "briefcase",
    },
    email: {
      label: "Correo",
      placeholder: "Por completar...",
      icon: "megaphone",
    },
    phone: { label: "Celular", placeholder: "Por completar...", icon: "chat" },
    program: {
      label: "Carrera",
      placeholder: "Por completar...",
      icon: "university",
    },
    modality: {
      label: "Modalidad",
      placeholder: "Por completar...",
      icon: "laptop",
    },
    city: { label: "Ciudad", placeholder: "Por completar...", icon: "scale" },
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header section with Circular Progress */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-100/80 bg-white/60 p-4 shadow-sm">
        <CircularProgress percentage={percentage} />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-800">
            Progreso de Ficha
          </h4>
          <p className="text-xs font-semibold text-slate-500">
            {filledCount} de 6 datos clave
          </p>
        </div>
      </div>

      {/* Fields List */}
      <div className="flex-1 space-y-3">
        {KEY_FIELDS.map((key) => {
          const val = leadFields[key]
          const isFilled = !!(val && val.trim().length > 0)
          const fieldInfo = fieldLabels[key]

          return (
            <div
              key={key}
              className={`flex items-start gap-3 rounded-xl border-1 p-3 transition-all duration-300 ${
                isFilled
                  ? "border-emerald-100/60 bg-emerald-50/20 shadow-sm"
                  : "border-slate-100 bg-white/40"
              }`}
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  isFilled
                    ? "border-emerald-200/50 bg-emerald-100/50 text-emerald-600"
                    : "border-slate-100 bg-slate-50 text-slate-400"
                }`}
              >
                {isFilled ? (
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <DecorativeIcon name={fieldInfo.icon} className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {fieldInfo.label}
                </span>
                <span
                  className={`mt-0.5 block truncate text-xs font-semibold ${
                    isFilled
                      ? "font-bold text-slate-800"
                      : "text-slate-400 italic"
                  }`}
                >
                  {isFilled ? val : fieldInfo.placeholder}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Button CTA */}
      <div className="pt-2">
        {isComplete ? (
          <Button
            type="button"
            className="animate-pulse-subtle flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-[0.98]"
            onClick={() => {
              alert(
                "¡Felicidades! Tu ficha está completa al 100%. Iniciando matricula directa..."
              )
            }}
          >
            <DecorativeIcon name="sparkles" className="size-4" />
            Confirmar Matrícula Directa
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-slate-200/50 bg-slate-100 text-xs font-bold text-slate-400"
          >
            Conversá con USILBot para completar
          </Button>
        )}
      </div>
    </div>
  )
}
