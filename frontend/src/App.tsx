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
// MetricRanking dan Historical akan digabung ke Analysis dan Compare
// import MetricRanking from "./pages/MetricRanking";
// import Historical from "./pages/Historical";
import {
  AppShell,
  NavItem,
  ProfileMenuItem,
} from "./components/layout/AppShell";
import { CatalogProvider, useCatalog } from "./contexts/CatalogContext";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";

type Page =
  | "dashboard"
  | "analysis"
  | "compare"
  | "simulation"
  | "reports"
  | "templates"
  | "profile"
  | "admin"
  | "sync-data";

function AppContent() {
  const { loading: catalogLoading, error: catalogError, retry } = useCatalog();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
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
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setCurrentPage("dashboard");
  };

  const handleUserUpdate = (updated: User) => {
    setUser(updated);
  };

  // Page configuration
  const pageConfig: Record<Page, { title: string; subtitle?: string }> = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Overview ranking & quick stats emiten bank",
    },
    analysis: {
      title: "Analysis",
      subtitle: "Screening & metric ranking emiten",
    },
    compare: {
      title: "Compare",
      subtitle: "Bandingkan emiten & historical trend",
    },
    simulation: {
      title: "Simulation",
      subtitle: "Skenario what-if untuk analisis",
    },
    reports: {
      title: "Reports",
      subtitle: "Lihat dan ekspor riwayat scoring",
    },
    templates: {
      title: "My Templates",
      subtitle: "Kelola template scoring Anda",
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
      key: "dashboard",
      label: "Dashboard",
      icon: "🏠",
      onSelect: () => setCurrentPage("dashboard"),
      active: currentPage === "dashboard",
      description: "Overview ranking & quick stats",
    },
    {
      key: "analysis",
      label: "Analysis",
      icon: "🔍",
      onSelect: () => setCurrentPage("analysis"),
      active: currentPage === "analysis",
      description: "Screening & metric ranking",
    },
    {
      key: "compare",
      label: "Compare",
      icon: "📊",
      onSelect: () => setCurrentPage("compare"),
      active: currentPage === "compare",
      description: "Bandingkan emiten & historical",
    },
    {
      key: "simulation",
      label: "Simulation",
      icon: "🎮",
      onSelect: () => setCurrentPage("simulation"),
      active: currentPage === "simulation",
      description: "Skenario what-if",
    },
    {
      key: "reports",
      label: "Reports",
      icon: "📋",
      onSelect: () => setCurrentPage("reports"),
      active: currentPage === "reports",
      description: "Riwayat & ekspor",
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
    if (currentPage === "dashboard" && user) {
      return <Dashboard user={user} onLogout={handleLogout} />;
    }
    if (currentPage === "analysis") {
      // Gabungan Screening + Metric Ranking - untuk sementara tampilkan Screening
      // TODO: Buat halaman Analysis yang menggabungkan keduanya
      return <Screening />;
    }
    if (currentPage === "compare") {
      // Gabungan Compare + Historical
      return <Compare />;
    }
    if (currentPage === "simulation") {
      return <Simulation />;
    }
    if (currentPage === "reports" && user) {
      return <Reports user={user} />;
    }
    if (currentPage === "templates" && user) {
      return <Templates user={user} />;
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
