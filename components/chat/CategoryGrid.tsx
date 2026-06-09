import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DecorativeIcon } from "./ChatIcons"
import { hoverToneClasses } from "@/lib/chat/utils"
import { categories } from "@/lib/constants/categories"
import type { Category } from "@/lib/types/chat"

export function CategoryGrid({
  onSelectCategory,
  onShowAllCareers,
  className,
}: {
  onSelectCategory: (category: Category) => void
  onShowAllCareers: () => void
  className?: string
}) {
  return (
    <section
      aria-label="Áreas académicas"
      className={`space-y-3 ${className || ""}`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <button
            key={category.title}
            type="button"
            onClick={() => onSelectCategory(category)}
            className="block w-full cursor-pointer text-left focus-visible:outline-none"
          >
            <Card className="group rounded-xl border border-slate-200/60 bg-white py-0 shadow-none transition-all duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_6px_20px_rgba(15,23,42,0.04)] active:scale-[0.99]">
              <CardContent className="flex min-h-20 items-center gap-3.5 p-3.5">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-100/50 bg-slate-50 text-slate-500 ring-1 ring-transparent transition-all duration-200 md:size-11 ${hoverToneClasses[category.tone]}`}
                >
                  <DecorativeIcon
                    name={category.icon}
                    className="size-5 md:size-5.5"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm leading-snug font-bold text-slate-800 transition-colors duration-200 group-hover:text-slate-950 md:text-sm">
                    {category.title}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {category.count}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="text-2xl text-slate-300 transition-colors duration-200 group-hover:text-slate-400"
                >
                  ›
                </span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={onShowAllCareers}
        className="h-10 w-full cursor-pointer rounded-xl !border-slate-200/80 !bg-white text-xs font-semibold !text-slate-600 transition-all duration-200 ease-out-expo hover:!border-blue-500 hover:!bg-white hover:!text-blue-700 active:scale-[0.99] md:text-sm"
      >
        <DecorativeIcon name="sparkles" className="size-4" />
        Ver todas las carreras
        <span aria-hidden="true" className="ml-auto text-2xl text-slate-400">
          ›
        </span>
      </Button>
    </section>
  )
}
