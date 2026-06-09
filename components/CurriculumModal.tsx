import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { CurriculumData, Course } from "@/lib/rag/curriculumData"

interface CurriculumModalProps {
  data: CurriculumData
  onClose: () => void
  onStartAdmission: (career: string) => void
}

export default function CurriculumModal({
  data,
  onClose,
  onStartAdmission,
}: CurriculumModalProps) {
  const availableCycles = data.cycles.map((c) => c.number).sort((a, b) => a - b)
  const [selectedCycle, setSelectedCycle] = useState<number>(
    availableCycles[0] ?? 1
  )

  const activeCycleData = data.cycles.find((c) => c.number === selectedCycle)
  const totalCoursesInActiveCycle = activeCycleData?.courses.length ?? 0
  const totalCreditsInActiveCycle =
    activeCycleData?.courses.reduce((sum, course) => sum + course.credits, 0) ??
    0

  const getAreaConfig = (area: Course["area"]) => {
    switch (area) {
      case "especialidad":
        return {
          bg: "bg-blue-50/20 hover:bg-blue-50/45 border-blue-200/40 hover:border-blue-300/60",
          text: "text-blue-950",
          pill: "bg-blue-100/50 text-[#07256d] border-blue-200/30",
          dot: "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]",
          label: "Especialidad USIL",
        }
      case "ciencias":
        return {
          bg: "bg-violet-50/20 hover:bg-violet-50/45 border-violet-200/40 hover:border-violet-300/60",
          text: "text-violet-950",
          pill: "bg-violet-100/50 text-violet-800 border-violet-200/30",
          dot: "bg-violet-600 shadow-[0_0_8px_rgba(124,58,237,0.4)]",
          label: "Ciencia e Ingeniería",
        }
      case "gestion":
        return {
          bg: "bg-amber-50/25 hover:bg-amber-50/45 border-amber-200/35 hover:border-amber-300/60",
          text: "text-amber-950",
          pill: "bg-amber-100/45 text-amber-900 border-amber-200/25",
          dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
          label: "Gestión y General",
        }
    }
  }

  return (
    <div
      className="animate-backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md md:p-6"
      onClick={onClose}
    >
      <div
        className="glass-card animate-modal-scale relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white/95 shadow-[0_32px_80px_-16px_rgba(7,37,109,0.15)] md:h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decoración superior sutil */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#07256d] via-[#f59e0b] to-[#14b8a6]" />

        {/* Encabezado Editorial */}
        <div className="border-b border-slate-100 bg-slate-50/30 px-6 pt-7 pb-5 md:px-10">
          <div className="flex items-start justify-between gap-4 md:items-center">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md bg-[#07256d]/5 px-2.5 py-0.5 text-[9px] font-extrabold text-[#07256d] uppercase tracking-widest border border-[#07256d]/10">
                  Plan curricular académico
                </span>
                {data.duration && (
                  <span className="text-[10px] font-bold text-slate-500">
                    • {data.duration}
                  </span>
                )}
                {data.credits && (
                  <span className="text-[10px] font-bold text-emerald-600">
                    • {data.credits} Créditos en total
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 truncate sm:text-2xl md:text-3xl">
                {data.career}
              </h2>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {/* Doble Grado / Internacional Banner */}
              <div className="hidden items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/40 px-4 py-2.5 shadow-sm md:flex">
                <div className="flex -space-x-1.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs shadow-sm ring-1 ring-slate-100">
                    🇵🇪
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full bg-white text-xs shadow-sm ring-1 ring-slate-100">
                    🇺🇸
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-amber-900 leading-normal">
                  <p className="font-extrabold uppercase tracking-wider text-amber-800">
                    Doble Grado Americano
                  </p>
                  <p className="opacity-90">San Ignacio University, Miami</p>
                </div>
              </div>

              {/* Botón Cerrar */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar modal"
                onClick={onClose}
                className="size-9 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition-all duration-300 active:scale-90"
              >
                <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Cuerpo del Modal Layout Editorial */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Navegación por Timeline (Izquierda) */}
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/20 px-6 py-4 md:w-52 md:border-b-0 md:border-r md:px-8 md:py-8">
            <p className="mb-4 hidden text-[10px] font-black uppercase tracking-widest text-slate-400 md:block">
              Ruta de Aprendizaje
            </p>

            {/* Mobile horizontal timeline */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 md:hidden">
              {availableCycles.map((cycleNum) => (
                <button
                  key={cycleNum}
                  onClick={() => setSelectedCycle(cycleNum)}
                  className={`flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-xs font-bold transition-all duration-200 ${
                    selectedCycle === cycleNum
                      ? "bg-[#07256d] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Ciclo {romanize(cycleNum)}
                </button>
              ))}
            </div>

            {/* Desktop vertical connected timeline */}
            <div className="relative hidden flex-col gap-1.5 md:flex">
              {/* Línea vertical de fondo */}
              <div className="absolute top-3 bottom-3 left-4 w-0.5 bg-slate-200" />

              {availableCycles.map((cycleNum) => {
                const isActive = selectedCycle === cycleNum
                return (
                  <button
                    key={cycleNum}
                    onClick={() => setSelectedCycle(cycleNum)}
                    className="group relative flex items-center gap-3 py-1.5 text-left transition-all duration-200 outline-none"
                  >
                    {/* Nodo */}
                    <span
                      className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all duration-300 ring-4 ${
                        isActive
                          ? "bg-[#07256d] text-white ring-blue-100"
                          : "bg-white text-slate-400 ring-transparent group-hover:text-slate-700"
                      }`}
                    >
                      {cycleNum}
                    </span>

                    {/* Texto descriptivo */}
                    <span
                      className={`text-xs font-extrabold transition-all duration-200 ${
                        isActive
                          ? "translate-x-0.5 text-[#07256d]"
                          : "text-slate-500 group-hover:text-slate-800"
                      }`}
                    >
                      Ciclo {romanize(cycleNum)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grilla de Cursos e Información del Ciclo (Derecha) */}
          <div className="flex flex-1 flex-col overflow-hidden px-6 py-5 md:px-10 md:py-8">
            {/* Cabecera del ciclo */}
            <div className="mb-5 flex flex-col justify-between gap-2 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#f59e0b]">
                  Detalle del Semestre
                </p>
                <h3 className="text-lg font-black text-slate-900">
                  Ciclo {romanize(selectedCycle)} Académico
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
                  {totalCoursesInActiveCycle} Asignaturas
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 border border-emerald-100">
                  {totalCreditsInActiveCycle} Créditos
                </span>
              </div>
            </div>

            {/* Listado con scroll */}
            <ScrollArea className="flex-1 pr-2">
              <div className="pb-8 pr-1">
                <div className="grid gap-4.5 py-1 sm:grid-cols-2">
                  {activeCycleData?.courses.map((course, idx) => {
                    const area = getAreaConfig(course.area)
                    return (
                      <div
                        key={`${course.name}-${idx}`}
                        className={`relative flex flex-col justify-between overflow-hidden rounded-2.5rem border p-5 shadow-sm transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-md ${area.bg}`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${area.pill}`}
                            >
                              <span className={`size-1.5 rounded-full ${area.dot}`} />
                              {area.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              Pregrado
                            </span>
                          </div>
                          <h4 className={`text-sm font-extrabold leading-snug tracking-tight pr-2 ${area.text}`}>
                            {course.name}
                          </h4>
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-slate-200/20 pt-3 text-[10px] font-bold text-slate-400">
                          <span className="uppercase tracking-widest text-[9px] font-extrabold">USIL CURRICULUM</span>
                          <span className="rounded-md bg-white px-2 py-0.5 text-slate-800 shadow-sm border border-slate-100">
                            {course.credits} cr
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Menciones Académicas (Diseño Editorial) */}
                {data.mentions && data.mentions.length > 0 && (
                  <div className="mt-8 rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      Menciones y Especializaciones Disponibles
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {data.mentions.map((mention) => (
                        <span
                          key={mention}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/50 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                        >
                          <span className="text-yellow-500">★</span>
                          {mention}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer Comercial - No Genérico */}
        <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-100 bg-slate-50/40 px-6 py-5 md:flex-row md:px-10">
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.3)]" />
              <span>Especialidad</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(139,92,246,0.3)]" />
              <span>Ciencias</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)]" />
              <span>Gestión / General</span>
            </div>
          </div>

          <Button
            onClick={() => onStartAdmission(data.career)}
            className="w-full shrink-0 rounded-2xl bg-[#07256d] px-6 py-5.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-950/20 hover:bg-[#061e57] active:scale-[0.98] transition-all duration-300 ease-out-expo md:w-auto"
          >
            Iniciar admisión para {data.career}
          </Button>
        </div>
      </div>
    </div>
  )
}

function romanize(num: number): string {
  const lookup: [string, number][] = [
    ["X", 10],
    ["IX", 9],
    ["VIII", 8],
    ["VII", 7],
    ["VI", 6],
    ["V", 5],
    ["IV", 4],
    ["III", 3],
    ["II", 2],
    ["I", 1],
  ]
  let roman = ""
  let temp = num
  for (const [letter, value] of lookup) {
    while (temp >= value) {
      roman += letter
      temp -= value
    }
  }
  return roman
}
