import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function BotAvatar({ size = "default" }: { size?: "default" | "lg" }) {
  return (
    <Avatar
      size={size}
      className={size === "lg" ? "size-11 md:size-12" : "size-8 md:size-9"}
    >
      <AvatarImage
        src="/usil-logo.jpg"
        alt="USIL"
        className="bg-[#07256d] object-contain"
      />
      <AvatarFallback className="bg-usil-navy text-xs font-semibold tracking-tight text-white ring-2 ring-blue-100">
        USIL
      </AvatarFallback>
      {size === "lg" ? (
        <AvatarBadge className="bg-emerald-400 ring-white" />
      ) : null}
    </Avatar>
  )
}
