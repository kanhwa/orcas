import { useState, useEffect } from "react";
import { BASE_URL, authMe, authLogout, User } from "./services/api";
import Login from "./pages/Login";
import ComparePage from "./pages/ComparePage";
import Simulation from "./pages/Simulation";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import SyncData from "./pages/SyncData";
import Analysis from "./pages/Analysis";
import Admin from "./pages/Admin";
import {
  AppShell,
  NavItem,
  ProfileMenuItem,
} from "./components/layout/AppShell";
import { CatalogProvider, useCatalog } from "./contexts/CatalogContext";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";

type Page =
  | "analysis"
  | "compare"
  | "simulation"
  | "reports"
  | "profile"
  | "admin"
  | "sync-data";

function AppContent() {
  const { loading: catalogLoading, error: catalogError, retry } = useCatalog();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("analysis");
  const apiBase = BASE_URL;

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
    setCurrentPage("analysis");
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setCurrentPage("analysis");
  };

  const handleUserUpdate = (updated: User) => {
    setUser(updated);
  };

  // Page configuration
  const pageConfig: Record<Page, { title: string; subtitle?: string }> = {
    analysis: {
      title: "Analysis",
      subtitle: "Screening & metric ranking for stocks",
    },
    compare: {
      title: "Compare",
      subtitle: "Compare stocks & historical trends",
    },
    simulation: {
      title: "Simulation",
      subtitle: "What-if scenario analysis",
    },
    reports: {
      title: "Reports",
      subtitle: "View and export scoring history",
    },
    profile: {
      title: "Profile",
      subtitle: "Manage account and settings",
    },
    admin: {
      title: "User Management",
      subtitle: "Manage users and account status",
    },
    "sync-data": {
      title: "Sync Data",
      subtitle: "Upload and manage CSV data files",
    },
  };

  const role = user?.role || "viewer";
  const isAdmin = role === "admin";

  // Guard admin-only pages (prevent access by manually switching state)
  useEffect(() => {
    if (!isAdmin && (currentPage === "admin" || currentPage === "sync-data")) {
      setCurrentPage("analysis");
    }
  }, [currentPage, isAdmin]);

  // Sidebar navigation - 5 main features
  const navItems: NavItem[] = [
    {
      key: "analysis",
      label: "Analysis",
      icon: "🔍",
      onSelect: () => setCurrentPage("analysis"),
      active: currentPage === "analysis",
      description:
        "Screen stocks using rule-based filters and explore metric rankings.",
    },
    {
      key: "compare",
      label: "Compare",
      icon: "📈",
      onSelect: () => setCurrentPage("compare"),
      active: currentPage === "compare",
      description:
        "Compare banks side-by-side and review historical performance.",
    },
    {
      key: "simulation",
      label: "Simulation",
      icon: "🧪",
      onSelect: () => setCurrentPage("simulation"),
      active: currentPage === "simulation",
      description: "Test scenarios by adjusting assumptions (no predictions).",
    },
    {
      key: "reports",
      label: "Reports",
      icon: "📋",
      onSelect: () => setCurrentPage("reports"),
      active: currentPage === "reports",
      description: "Export and organize saved results into a report.",
    },
  ];

  // Profile dropdown menu items - different for admin vs employee
  const profileMenuItems: ProfileMenuItem[] = [
    {
      key: "profile",
      label: "My Profile",
      icon: "👤",
      onClick: () => setCurrentPage("profile"),
    },
    ...(isAdmin
      ? [
          {
            key: "admin",
            label: "User Management",
            icon: "👥",
            onClick: () => setCurrentPage("admin"),
            separator: true,
          },
          {
            key: "sync-data",
            label: "Sync Data",
            icon: "🔄",
            onClick: () => setCurrentPage("sync-data"),
          },
        ]
      : []),
    {
      key: "logout",
      label: "Logout",
      icon: "🚪",
      onClick: handleLogout,
      danger: true,
      separator: true,
    },
  ];

  const renderPage = () => {
    if (currentPage === "analysis") {
      return <Analysis />;
    }
    if (currentPage === "compare") {
      return <ComparePage />;
    }
    if (currentPage === "simulation") {
      return <Simulation />;
    }
    if (currentPage === "reports" && user) {
      return <Reports user={user} />;
    }
    if (currentPage === "profile" && user) {
      return <Profile user={user} onUserUpdate={handleUserUpdate} />;
    }
    if (currentPage === "sync-data" && isAdmin && user) {
      return <SyncData user={user} />;
    }
    if (currentPage === "admin" && isAdmin && user) {
      return <Admin user={user} />;
    }
    // Placeholder content for sections that are not yet implemented
    return (
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
            {pageConfig[currentPage].title}
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-subtle))]">
            Feature coming soon.
          </p>
        </div>
      </div>
    );
  };

  // Show loading while checking session or catalog
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-subtle))]">
        <p>Loading...</p>
      </div>
    );
  }

  // Show login if not authenticated (do not block on catalog)
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // After login, wait for catalog
  if (catalogLoading) {
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

  return (
    <AppShell
      pageTitle={pageConfig[currentPage].title}
      pageSubtitle={pageConfig[currentPage].subtitle}
      userDisplay={user.username}
      userRole={user.role}
      userAvatar={
        user.avatar_url
          ? user.avatar_url.startsWith("http")
            ? user.avatar_url
            : `${apiBase}${user.avatar_url}`
          : undefined
      }
      navItems={navItems}
      profileMenuItems={profileMenuItems}
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
