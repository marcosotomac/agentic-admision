import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DecorativeIcon } from "./ChatIcons"
import type { QuickChip } from "@/lib/types/chat"

export function Composer({
  inputValue,
  isSending,
  onInputChange,
  onQuickPrompt,
  onSubmit,
  quickChips,
}: {
  inputValue: string
  isSending: boolean
  onInputChange: (value: string) => void
  onQuickPrompt: (message: string) => void
  onSubmit: (message: string) => void
  quickChips: QuickChip[]
}) {
  return (
    <footer className="border-t border-slate-100/60 px-4 py-3 sm:px-6 md:px-8">
      <form
        className="mx-auto w-full max-w-[62rem] space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(inputValue)
        }}
      >
        <div className="relative">
          <Input
            aria-label="Consulta para USILBot"
            placeholder="Escribe tu consulta..."
            value={inputValue}
            disabled={isSending}
            onChange={(event) => onInputChange(event.target.value)}
            className="h-11 rounded-xl border-slate-200 bg-white px-4 pr-20 text-xs shadow-sm placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 sm:h-12 sm:px-5 sm:pr-24 sm:text-sm"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Adjuntar archivo"
                  className="size-8 rounded-lg text-slate-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 active:scale-90 sm:size-9"
                  disabled={isSending}
                >
                  <DecorativeIcon name="paperclip" className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Adjuntar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Enviar consulta"
                  size="icon"
                  type="submit"
                  disabled={isSending || inputValue.trim().length === 0}
                  className="size-8 rounded-lg bg-[#07256d] text-white shadow-md shadow-blue-950/15 transition-all duration-200 hover:bg-[#07256d]/90 active:scale-95 sm:size-9.5"
                >
                  <DecorativeIcon name="send" className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:pb-0">
          {quickChips.map((chip) => (
            <Button
              key={chip.label}
              variant="outline"
              type="button"
              disabled={isSending}
              onClick={() => onQuickPrompt(chip.label)}
              className="h-9 shrink-0 justify-center gap-2 rounded-lg border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-600 transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm active:scale-[0.97] md:shrink"
            >
              <DecorativeIcon
                name={chip.icon}
                className="size-4 text-blue-700"
              />
              <span className="truncate">{chip.label}</span>
            </Button>
          ))}
        </div>

        <p className="text-center text-xs font-medium text-slate-400">
          La USIL protege tus datos. Conoce nuestra{" "}
          <span className="text-blue-700">Política de Privacidad.</span>
        </p>
      </form>
    </footer>
  )
}
