import { ReactNode, useState, useRef, useEffect, CSSProperties } from "react";
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

const HEADER_HEIGHT = 80;
const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_STORAGE_KEY = "orcas:sidebar-collapsed";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });
  const profileRef = useRef<HTMLDivElement>(null);

  const shellStyle = {
    ["--app-header-height" as string]: `${HEADER_HEIGHT}px`,
  } as CSSProperties;

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
    <div
      className="min-h-screen bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]"
      style={shellStyle}
    >
      {/* Header with gradient background */}
      <header
        className="sticky top-0 z-30 bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] px-6 py-3 shadow-lg"
        style={{ minHeight: "var(--app-header-height)" }}
      >
        <div className="flex items-center justify-between">
          {/* Logo & Brand - Left */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden rounded-lg bg-white/20 p-2 text-white transition hover:bg-white/30 lg:inline-flex"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("h-5 w-5 transition", sidebarCollapsed && "scale-x-[-1]")}
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-2xl text-white">
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
        <aside
          className="hidden shrink-0 border-r border-[rgb(var(--color-border))] bg-white transition-[width] duration-200 ease-in-out lg:block"
          style={{
            width: `${sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED}px`,
            position: "sticky",
            top: "var(--app-header-height)",
            height: "calc(100vh - var(--app-header-height))",
          }}
        >
          <div className="flex h-full flex-col">
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 transition-[width] duration-200 ease-in-out">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onSelect}
                  disabled={item.disabled}
                  className={cn(
                    "flex w-full items-center rounded-xl px-3 py-3 text-sm text-left transition",
                    sidebarCollapsed ? "justify-center gap-0" : "gap-3",
                    item.active
                      ? "bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] text-white font-semibold shadow-md"
                      : "text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface))]",
                    item.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  {!sidebarCollapsed && <span className="flex-1">{item.label}</span>}
                  {!sidebarCollapsed && item.description && (
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
          </div>
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
