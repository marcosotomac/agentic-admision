import { ReactNode } from "react"
import type { IconName } from "@/lib/types/chat"

export function DecorativeIcon({
  name,
  className,
}: {
  name: IconName
  className?: string
}) {
  const path = iconPaths[name]

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  )
}

const iconPaths: Record<IconName, ReactNode> = {
  admission: <path d="M7 3h7l4 4v14H7z M14 3v5h5 M10 13h6 M10 17h4" />,
  "arrow-right": <path d="M5 12h14 M13 6l6 6-6 6" />,
  bank: <path d="M4 10l8-5 8 5 M6 10v8 M10 10v8 M14 10v8 M18 10v8 M4 19h16" />,
  briefcase: <path d="M9 7V5h6v2 M4 8h16v11H4z M4 12h16 M10 12v2h4v-2" />,
  calendar: (
    <path d="M7 3v4 M17 3v4 M4 8h16 M5 5h14v15H5z M8 12h.01 M12 12h.01 M16 12h.01 M8 16h.01 M12 16h.01" />
  ),
  chat: <path d="M5 6h14v9H8l-4 4V6z M8 10h.01 M12 10h.01 M16 10h.01" />,
  code: <path d="M8 8l-4 4 4 4 M16 8l4 4-4 4 M14 5l-4 14" />,
  dollar: (
    <path d="M12 3v18 M16 7.5c-1-1-2.4-1.5-4-1.5-2.1 0-3.5 1-3.5 2.5 0 3.5 7 1.7 7 5.5 0 1.7-1.6 3-4 3-1.8 0-3.3-.6-4.4-1.7" />
  ),
  heart: (
    <path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5z M8 12h2l1-2 2 5 1.2-3H17" />
  ),
  laptop: <path d="M5 6h14v10H5z M3 19h18" />,
  megaphone: <path d="M4 13h3l10 4V7L7 11H4z M7 13l2 6h3" />,
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 7 7 0 1 0 20 15.5z" />,
  palette: (
    <path d="M12 4a8 8 0 0 0 0 16h1.5a2 2 0 0 0 1.3-3.5 1.8 1.8 0 0 1 1.2-3.2h1A3 3 0 0 0 20 10c0-3.3-3.6-6-8-6z M8 11h.01 M10 8h.01 M14 8h.01 M16 11h.01" />
  ),
  paperclip: (
    <path d="M8 12.5l6.7-6.7a3 3 0 0 1 4.2 4.2L10.5 18.4a5 5 0 0 1-7.1-7.1l8.1-8.1" />
  ),
  refresh: <path d="M20 6v5h-5 M19 11a7 7 0 1 0-2.1 5" />,
  scale: <path d="M12 3v18 M5 6h14 M7 6l-3 6h6z M17 6l-3 6h6z M8 21h8" />,
  send: <path d="M21 3L10 14 M21 3l-7 18-4-7-7-4z" />,
  sparkles: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8z" />
  ),
  sun: (
    <path d="M12 4v2 M12 18v2 M4 12H2 M22 12h-2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4 M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
  ),
  trophy: (
    <path d="M8 4h8v4a4 4 0 0 1-8 0z M8 6H5a3 3 0 0 0 3 3 M16 6h3a3 3 0 0 1-3 3 M12 12v4 M9 20h6 M10 16h4" />
  ),
  university: (
    <path d="M12 4l8 5H4z M6 10v8 M10 10v8 M14 10v8 M18 10v8 M4 20h16" />
  ),
  menu: <path d="M4 12h16M4 6h16M4 18h16" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
}
