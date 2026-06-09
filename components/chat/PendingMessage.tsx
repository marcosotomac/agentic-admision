import { useState, useEffect } from "react"
import { PENDING_STATUS_STEPS } from "@/lib/chat/utils"

export function PendingMessage() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % PENDING_STATUS_STEPS.length)
    }, 1800)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col gap-2 py-1 text-slate-500">
      <div className="flex items-center gap-2">
        <span className="flex gap-1">
          <span className="size-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-blue-400" />
        </span>
        <span className="text-xs font-semibold text-slate-400 select-none">
          USILBot está pensando
        </span>
      </div>
      <p className="animate-fade-in-up text-xs font-medium text-slate-500/80 italic transition-all duration-300">
        {PENDING_STATUS_STEPS[stepIndex]}
      </p>
    </div>
  )
}
