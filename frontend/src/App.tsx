import { useState, useEffect } from "react";
import { authMe, authLogout, User } from "./services/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/ComparePage";
import Simulation from "./pages/Simulation";
import Profile from "./pages/Profile";
import Templates from "./pages/Templates";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import SyncData from "./pages/SyncData";
import Screening from "./pages/Screening";
import MetricRanking from "./pages/MetricRanking";
import Historical from "./pages/Historical";
import {
  AppShell,
  NavItem,
  ProfileMenuItem,
} from "./components/layout/AppShell";
import { CatalogProvider, useCatalog } from "./contexts/CatalogContext";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";

type Page =
  | "home"
  | "simulation"
  | "compare"
  | "screening"
  | "metric-ranking"
  | "historical"
  | "scoring"
  | "templates"
  | "reports"
  | "profile"
  | "admin"
  | "sync-data";

function AppContent() {
  const { loading: catalogLoading, error: catalogError, retry } = useCatalog();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("home");

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
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setCurrentPage("home");
  };

  const handleUserUpdate = (updated: User) => {
    setUser(updated);
  };

  // Page configuration
  const pageConfig: Record<Page, { title: string; subtitle?: string }> = {
    home: {
      title: "Home",
      subtitle: "Overview ranking emiten bank",
    },
    screening: {
      title: "Screening",
      subtitle: "Filter saham berdasarkan kriteria metrik",
    },
    "metric-ranking": {
      title: "Metric Ranking",
      subtitle: "Top emiten per metrik keuangan",
    },
    historical: {
      title: "Historical",
      subtitle: "Bandingkan performa emiten antar periode",
    },
    scoring: {
      title: "Scoring",
      subtitle: "Kalkulasi skor WSM",
    },
    templates: {
      title: "My Templates",
      subtitle: "Kelola template scoring Anda",
    },
    compare: {
      title: "Compare",
      subtitle: "Bandingkan skor WSM beberapa ticker",
    },
    simulation: {
      title: "Simulation",
      subtitle: "Skenario what-if untuk analisis",
    },
    reports: {
      title: "Reports",
      subtitle: "Lihat dan ekspor riwayat scoring",
    },
    profile: {
      title: "Profile",
      subtitle: "Kelola akun dan pengaturan",
    },
    admin: {
      title: "User Management",
      subtitle: "Kelola user dan status akun",
    },
    "sync-data": {
      title: "Sync Data",
      subtitle: "Upload dan kelola file data CSV",
    },
  };

  const role = user?.role || "viewer";
  const isAdmin = role === "admin";

  // Sidebar navigation - 5 main features
  const navItems: NavItem[] = [
    {
      key: "home",
      label: "Home",
      icon: "🏠",
      onSelect: () => setCurrentPage("home"),
      active: currentPage === "home",
      description: "Beranda dengan ranking WSM",
    },
    {
      key: "screening",
      label: "Screening",
      icon: "🔍",
      onSelect: () => setCurrentPage("screening"),
      active: currentPage === "screening",
      description: "Filter saham dengan kriteria",
    },
    {
      key: "metric-ranking",
      label: "Metric Ranking",
      icon: "📊",
      onSelect: () => setCurrentPage("metric-ranking"),
      active: currentPage === "metric-ranking",
      description: "Peringkat per metrik",
    },
    {
      key: "historical",
      label: "Historical",
      icon: "📈",
      onSelect: () => setCurrentPage("historical"),
      active: currentPage === "historical",
      description: "Perbandingan historis",
    },
    {
      key: "compare",
      label: "Compare",
      icon: "⚖️",
      onSelect: () => setCurrentPage("compare"),
      active: currentPage === "compare",
      description: "Bandingkan ticker",
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
    {
      key: "templates",
      label: "My Templates",
      icon: "📝",
      onClick: () => setCurrentPage("templates"),
    },
    ...(isAdmin
      ? [
          {
            key: "admin",
            label: "User Management",
            icon: "👥",
            onClick: () => setCurrentPage("admin"),
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
    },
  ];

  const renderPage = () => {
    if (currentPage === "home" && user) {
      return <Dashboard user={user} onLogout={handleLogout} />;
    }
    if (currentPage === "screening") {
      return <Screening />;
    }
    if (currentPage === "metric-ranking") {
      return <MetricRanking />;
    }
    if (currentPage === "historical") {
      return <Historical />;
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
    if (currentPage === "admin" && isAdmin && user) {
      return <Admin user={user} />;
    }
    if (currentPage === "sync-data" && isAdmin && user) {
      return <SyncData user={user} />;
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

  // Show login if not authenticated
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AppShell
      pageTitle={pageConfig[currentPage].title}
      pageSubtitle={pageConfig[currentPage].subtitle}
      userDisplay={user.username}
      userRole={user.role}
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
