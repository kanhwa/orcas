import { ReactNode } from "react";
import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";
import InfoTip from "../InfoTip";
import { Badge } from "../ui/Badge";

export interface NavItem {
  key: string;
  label: string;
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
  description?: string;
}

interface AppShellProps {
  pageTitle: string;
  userDisplay?: string;
  navItems: NavItem[];
  children: ReactNode;
  onProfile?: () => void;
  onLogout?: () => void;
  contextualInfo?: string;
}

export function AppShell({
  pageTitle,
  userDisplay,
  navItems,
  children,
  onProfile,
  onLogout,
  contextualInfo,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]">
      {/* Top navigation */}
      <header className="flex items-center justify-between border-b border-[rgb(var(--color-border))] bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(var(--color-primary))] text-white font-bold">
            OR
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-[rgb(var(--color-primary))]">
              ORCAS
            </div>
            <div className="text-xs text-[rgb(var(--color-text-subtle))]">
              Analyst workspace
            </div>
          </div>
          {contextualInfo && (
            <div className="ml-4 text-xs text-[rgb(var(--color-text-muted))] flex items-center gap-1">
              <Badge className="bg-[rgb(var(--color-surface))] text-[rgb(var(--color-primary))]">
                Info
              </Badge>
              <span>{contextualInfo}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-[rgb(var(--color-text))]">
              {userDisplay || "User"}
            </div>
            <div className="text-xs text-[rgb(var(--color-text-subtle))]">
              Analyst
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onProfile}>
              Profile
            </Button>
            <Button variant="secondary" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-[rgb(var(--color-border))] bg-white p-4 lg:block">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-subtle))]">
            Navigation
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                disabled={item.disabled}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition",
                  item.active
                    ? "bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))] font-semibold"
                    : "text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface))]",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.description && <InfoTip content={item.description} />}
                </span>
                {item.active && (
                  <span className="text-[rgb(var(--color-primary))]">•</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">
                {pageTitle}
              </h1>
              <p className="text-sm text-[rgb(var(--color-text-subtle))]">
                Curated tools for ranking, simulation, and comparisons.
              </p>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
