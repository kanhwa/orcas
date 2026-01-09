import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "../../utils/cn";
import InfoTip from "../InfoTip";
import { AvatarBadge } from "../AvatarBadge";

export interface NavItem {
  key: string;
  label: string;
  icon?: string;
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
  description?: string;
}

export interface ProfileMenuItem {
  key: string;
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface AppShellProps {
  pageTitle: string;
  pageSubtitle?: string;
  userDisplay?: string;
  userRole?: string;
  userAvatar?: string;
  navItems: NavItem[];
  profileMenuItems: ProfileMenuItem[];
  children: ReactNode;
}

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-medium",
        isAdmin
          ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
          : "bg-blue-500/20 text-blue-200 border border-blue-500/30"
      )}
    >
      {isAdmin ? "Admin" : "Employee"}
    </span>
  );
}

export function AppShell({
  pageTitle,
  pageSubtitle,
  userDisplay,
  userRole,
  userAvatar,
  navItems,
  profileMenuItems,
  children,
}: AppShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]">
      {/* Header with gradient background */}
      <header className="bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          {/* Logo & Brand - Left */}
          <div className="flex items-center gap-3">
            {/* Orca Icon */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-2xl">
              🐋
            </div>
            <div>
              <div className="text-lg font-bold tracking-wide text-white">
                ORCAS
              </div>
              <div className="text-xs text-white/70">Analyst Workspace</div>
            </div>
          </div>

          {/* User Panel - Right */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2 transition hover:bg-white/20"
            >
              {/* Avatar */}
              <AvatarBadge
                username={userDisplay || "U"}
                avatarUrl={userAvatar}
                size="sm"
                className="bg-white/30 border-2 border-white/50"
              />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-white">
                  {userDisplay || "User"}
                </span>
                {userRole && <RoleBadge role={userRole} />}
              </div>
              <svg
                className={cn(
                  "h-4 w-4 text-white/70 transition-transform",
                  profileOpen && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-[rgb(var(--color-border))] py-2 z-50">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-[rgb(var(--color-border))]">
                  <div className="font-semibold text-[rgb(var(--color-text))]">
                    {userDisplay || "User"}
                  </div>
                  <div className="text-xs text-[rgb(var(--color-text-subtle))] capitalize">
                    {userRole === "admin" ? "Administrator" : "Employee"}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {profileMenuItems.map((item, index) => (
                    <div key={item.key}>
                      {item.separator && index > 0 && (
                        <div className="my-1 border-t border-[rgb(var(--color-border))]" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          item.onClick();
                          setProfileOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition",
                          item.danger
                            ? "text-red-600 hover:bg-red-50"
                            : "text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface))]"
                        )}
                      >
                        {item.icon && (
                          <span className="text-base">{item.icon}</span>
                        )}
                        <span>{item.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-[rgb(var(--color-border))] bg-white lg:block">
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                disabled={item.disabled}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-left transition",
                  item.active
                    ? "bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] text-white font-semibold shadow-md"
                    : "text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface))]",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {item.icon && <span className="text-lg">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.description && (
                  <span
                    className="shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <InfoTip
                      content={item.description}
                      ariaLabel={`Info: ${item.label}`}
                    />
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="text-sm text-[rgb(var(--color-text-subtle))] mt-1">
                {pageSubtitle}
              </p>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
