import Image from "next/image"
import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DecorativeIcon } from "./ChatIcons"
import { countFilledFields } from "@/lib/chat/utils"
import type { LeadFields } from "@/lib/leads/scoring"

export function ChatHeader({
  onToggleProfile,
  leadFields,
  showDesktopProfile,
  showMobileProfile,
}: {
  onToggleProfile: () => void
  leadFields: LeadFields
  showDesktopProfile: boolean
  showMobileProfile: boolean
}) {
  const filledCount = countFilledFields(leadFields)
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-100/80 px-5 py-4 sm:px-6 md:px-8 md:py-4.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#07256d] p-1.5 shadow-sm">
          <Image
            src="/usil-logo.jpg"
            alt="USIL"
            width={32}
            height={32}
            priority
            className="object-contain"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-sm font-bold tracking-tight text-slate-950 sm:text-base md:text-[1.05rem]">
            Asistente de Admisión
          </h1>
          <p className="text-[10px] font-medium text-slate-500 sm:text-xs">
            Universidad San Ignacio de Loyola
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <HeaderAction
          label="Actualizar"
          onClick={() => window.location.reload()}
        >
          <DecorativeIcon name="refresh" className="size-4 text-slate-800" />
        </HeaderAction>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ver Ficha de Admisión"
              onClick={onToggleProfile}
              className={`relative size-8 rounded-lg transition-all duration-200 active:scale-95 ${
                showDesktopProfile
                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100/80 hover:text-blue-800 md:bg-blue-50 md:text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${
                showMobileProfile
                  ? "max-md:bg-blue-50 max-md:text-blue-700"
                  : "max-md:bg-transparent max-md:text-slate-600"
              }`}
            >
              <DecorativeIcon
                name="admission"
                className="size-4 text-blue-700"
              />
              {filledCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white shadow-sm ring-1 ring-white">
                  {filledCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver Ficha de Admisión</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

function HeaderAction({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className="size-8 rounded-lg text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
