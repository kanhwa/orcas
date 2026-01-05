import { useState, useEffect } from "react";
import {
  authMe,
  authLogout,
  User,
  getMetricsCatalog,
  MetricsCatalog,
} from "./services/api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Simulation from "./pages/Simulation";
import Compare from "./pages/Compare";

type Page = "dashboard" | "simulation" | "compare";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [catalog, setCatalog] = useState<MetricsCatalog | null>(null);

  // Check existing session on mount and fetch catalog
  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await authMe();
        setUser(currentUser);
        // Fetch catalog after successful auth
        const catalogData = await getMetricsCatalog();
        setCatalog(catalogData);
      } catch {
        // Not logged in or session expired
        setUser(null);
        setCatalog(null);
      } finally {
        setChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    // Fetch catalog after login
    try {
      const catalogData = await getMetricsCatalog();
      setCatalog(catalogData);
    } catch (error) {
      console.error("Failed to fetch catalog:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // Ignore logout errors
    }
    setUser(null);
    setCatalog(null);
    setCurrentPage("dashboard");
  };

  // Show loading while checking session
  if (checking) {
    return (
      <div style={styles.loading}>
        <p>Loading...</p>
      </div>
    );
  }

  // Simple routing based on auth state
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div>
      {/* Navigation Bar */}
      <nav style={styles.nav}>
        <div style={styles.navBrand}>🐳 ORCAS</div>
        <div style={styles.navLinks}>
          <button
            onClick={() => setCurrentPage("dashboard")}
            style={{
              ...styles.navButton,
              background:
                currentPage === "dashboard" ? "#007bff" : "transparent",
              color: currentPage === "dashboard" ? "#fff" : "#007bff",
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentPage("simulation")}
            style={{
              ...styles.navButton,
              background:
                currentPage === "simulation" ? "#007bff" : "transparent",
              color: currentPage === "simulation" ? "#fff" : "#007bff",
            }}
          >
            Simulation
          </button>
          <button
            onClick={() => setCurrentPage("compare")}
            style={{
              ...styles.navButton,
              background: currentPage === "compare" ? "#007bff" : "transparent",
              color: currentPage === "compare" ? "#fff" : "#007bff",
            }}
          >
            Compare
          </button>
        </div>
        <div style={styles.navRight}>
          <span style={styles.navUser}>{user.username}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </nav>

      {/* Page Content */}
      <main style={styles.main}>
        {currentPage === "dashboard" && (
          <Dashboard user={user} onLogout={handleLogout} catalog={catalog} />
        )}
        {currentPage === "simulation" && <Simulation catalog={catalog} />}
        {currentPage === "compare" && <Compare catalog={catalog} />}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f7fa",
    color: "#666",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1.5rem",
    background: "#343a40",
    color: "#fff",
  },
  navBrand: {
    fontSize: "1.25rem",
    fontWeight: "bold",
  },
  navLinks: {
    display: "flex",
    gap: "0.5rem",
  },
  navButton: {
    padding: "0.5rem 1rem",
    border: "1px solid #007bff",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem",
    transition: "all 0.2s",
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  navUser: {
    color: "#adb5bd",
    fontSize: "0.9rem",
  },
  logoutButton: {
    padding: "0.5rem 1rem",
    background: "#dc3545",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  main: {
    minHeight: "calc(100vh - 60px)",
    background: "#f5f7fa",
  },
};
