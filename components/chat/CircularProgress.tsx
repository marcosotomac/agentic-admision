export function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex size-14 shrink-0 items-center justify-center">
      <svg className="size-14 -rotate-90">
        {/* Background circle */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          className="fill-transparent stroke-slate-100"
          strokeWidth="4"
        />
        {/* Active progress circle */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          className="fill-transparent stroke-emerald-500 transition-all duration-500 ease-out"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-slate-700">
        {Math.round(percentage)}%
      </span>
    </div>
  )
}
