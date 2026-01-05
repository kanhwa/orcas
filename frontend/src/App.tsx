import { useState, useEffect } from "react";
import { authMe, authLogout, User } from "./services/api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/ComparePage";
import Simulation from "./pages/Simulation";
import Profile from "./pages/Profile";
import Templates from "./pages/Templates";
import Reports from "./pages/Reports";
import { AppShell, NavItem } from "./components/layout/AppShell";
import { CatalogProvider, useCatalog } from "./contexts/CatalogContext";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";

type Page =
  | "dashboard"
  | "simulation"
  | "compare"
  | "screening"
  | "scoring"
  | "templates"
  | "reports"
  | "profile"
  | "admin";

function AppContent() {
  const { loading: catalogLoading, error: catalogError, retry } = useCatalog();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await authMe();
        setUser(currentUser);
      } catch {
        // Not logged in or session expired
        setUser(null);
      } finally {
        setChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setAuthView("login");
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setCurrentPage("dashboard");
    setAuthView("login");
  };

  const handleUserUpdate = (updated: User) => {
    setUser(updated);
  };

  const pageTitleMap: Record<Page, string> = {
    dashboard: "Dashboard",
    screening: "Screening",
    scoring: "Scoring",
    templates: "Templates",
    compare: "Compare",
    simulation: "Simulation",
    reports: "Reports (Export)",
    profile: "Profile",
    admin: "Admin",
  };
  const role = user?.role || "viewer";
  const isAdmin = role === "admin";
  const navItems: NavItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      onSelect: () => setCurrentPage("dashboard"),
      active: currentPage === "dashboard",
      description: "Overview and ranking tools",
    },
    {
      key: "compare",
      label: "Compare",
      onSelect: () => setCurrentPage("compare"),
      active: currentPage === "compare",
      description: "Compare tickers across years",
    },
    {
      key: "simulation",
      label: "Simulation",
      onSelect: () => setCurrentPage("simulation"),
      active: currentPage === "simulation",
      description: "Scenario testing",
    },
    {
      key: "templates",
      label: "Templates",
      onSelect: () => setCurrentPage("templates"),
      active: currentPage === "templates",
      description: "Manage scoring templates",
    },
    {
      key: "reports",
      label: "Reports",
      onSelect: () => setCurrentPage("reports"),
      active: currentPage === "reports",
      description: "View & export scoring history",
    },
    {
      key: "profile",
      label: "Profile",
      onSelect: () => setCurrentPage("profile"),
      active: currentPage === "profile",
      description: "Manage account",
    },
    ...(isAdmin
      ? [
          {
            key: "admin" as const,
            label: "Admin",
            onSelect: () => setCurrentPage("admin"),
            active: currentPage === "admin",
            description: "User management (placeholder)",
          },
        ]
      : []),
  ];

  const renderPage = () => {
    if (currentPage === "dashboard" && user) {
      return <Dashboard user={user} onLogout={handleLogout} />;
    }
    if (currentPage === "compare") {
      return <Compare />;
    }
    if (currentPage === "simulation") {
      return <Simulation />;
    }
    if (currentPage === "templates" && user) {
      return <Templates user={user} />;
    }
    if (currentPage === "reports" && user) {
      return <Reports user={user} />;
    }
    if (currentPage === "profile" && user) {
      return <Profile user={user} onUserUpdate={handleUserUpdate} />;
    }
    if (currentPage === "admin" && isAdmin) {
      return (
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
              Admin
            </h3>
            <p className="text-sm text-[rgb(var(--color-text-subtle))]">
              Placeholder for user management (requires backend support).
            </p>
          </div>
        </div>
      );
    }
    // Placeholder content for sections that are not yet implemented
    return (
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
            {pageTitleMap[currentPage]}
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-subtle))]">
            Feature coming soon.
          </p>
        </div>
      </div>
    );
  };

  // Show loading while checking session or catalog
  if (checking || catalogLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-subtle))]">
        <p>Loading...</p>
      </div>
    );
  }

  // Show catalog error with retry
  if (catalogError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-surface))] p-8">
        <Card>
          <div className="card-body text-center">
            <h2 className="text-xl font-bold text-[rgb(var(--color-text))] mb-4">
              Catalog Unavailable
            </h2>
            <p className="text-sm text-[rgb(var(--color-text-subtle))] mb-6">
              {catalogError}
            </p>
            <Button onClick={retry}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Simple routing based on auth state
  if (!user) {
    return authView === "login" ? (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthView("register")}
      />
    ) : (
      <Register
        onRegistered={() => setAuthView("login")}
        onCancel={() => setAuthView("login")}
      />
    );
  }

  return (
    <AppShell
      pageTitle={pageTitleMap[currentPage]}
      userDisplay={user.username}
      navItems={navItems}
      onLogout={handleLogout}
      contextualInfo="Catalog-driven metrics and WCAG-compliant UI"
    >
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <CatalogProvider>
      <AppContent />
    </CatalogProvider>
  );
}
