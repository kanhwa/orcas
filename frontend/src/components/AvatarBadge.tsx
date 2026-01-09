import { cn } from "../utils/cn";

interface AvatarBadgeProps {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
};

export function AvatarBadge({
  username,
  avatarUrl,
  size = "md",
  className,
}: AvatarBadgeProps) {
  const letter = (username?.[0] || "U").toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full bg-white overflow-hidden flex items-center justify-center font-semibold border border-gray-200",
        sizeClasses[size],
        className
      )}
    >
      {avatarUrl && avatarUrl !== "" ? (
        <img
          src={avatarUrl}
          alt={username}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-gray-700">{letter}</span>
      )}
    </div>
  );
}
