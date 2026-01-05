import { useState } from "react";
import {
  authLogin,
  authMe,
  authLogout,
  wsmScore,
  sectionRanking,
  User,
  WSMScoreResponse,
} from "../services/api";

/**
 * API Smoke Test Page
 * Quick test for all auth + WSM endpoints with cookie session.
 */
export default function ApiSmokeTest() {
  const [user, setUser] = useState<User | null>(null);
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const clearState = () => {
    setResponse("");
    setError("");
  };

  const handleLogin = async () => {
    clearState();
    setLoading(true);
    try {
      const result = await authLogin("admin", "admin123");
      setUser(result);
      setResponse(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      setError(`[${e.status || "?"}] ${e.detail || "Login failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMe = async () => {
    clearState();
    setLoading(true);
    try {
      const result = await authMe();
      setUser(result);
      setResponse(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      setError(`[${e.status || "?"}] ${e.detail || "Get me failed"}`);
      if (e.status === 401) setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleWsmScore = async () => {
    clearState();
    setLoading(true);
    try {
      const payload = {
        year: 2022,
        metrics: [
          {
            metric_name: "Return on Assets (ROA)",
            type: "benefit" as const,
            weight: 1,
          },
          { metric_name: "Beban Usaha", type: "cost" as const, weight: 1 },
        ],
        limit: 5,
      };
      const result: WSMScoreResponse = await wsmScore(payload);
      setResponse(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      setError(`[${e.status || "?"}] ${e.detail || "WSM Score failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionRanking = async () => {
    clearState();
    setLoading(true);
    try {
      const payload = {
        year: 2022,
        section: "income" as const,
        limit: 5,
      };
      const result = await sectionRanking(payload);
      setResponse(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      setError(`[${e.status || "?"}] ${e.detail || "Section Ranking failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    clearState();
    setLoading(true);
    try {
      const result = await authLogout();
      setUser(null);
      setResponse(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      setError(`[${e.status || "?"}] ${e.detail || "Logout failed"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>🔬 ORCAS API Smoke Test</h1>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Status:</strong>{" "}
        {user ? (
          <span style={{ color: "green" }}>
            Logged in as <b>{user.username}</b> ({user.role})
          </span>
        ) : (
          <span style={{ color: "gray" }}>Not logged in</span>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button onClick={handleLogin} disabled={loading}>
          🔑 Login (admin)
        </button>
        <button onClick={handleMe} disabled={loading}>
          👤 Me
        </button>
        <button onClick={handleWsmScore} disabled={loading}>
          📊 WSM Score
        </button>
        <button onClick={handleSectionRanking} disabled={loading}>
          📈 Section Ranking
        </button>
        <button onClick={handleLogout} disabled={loading}>
          🚪 Logout
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {error && (
        <pre
          style={{
            background: "#fee",
            border: "1px solid #c00",
            padding: "1rem",
            color: "#900",
            whiteSpace: "pre-wrap",
          }}
        >
          ❌ Error: {error}
        </pre>
      )}

      {response && (
        <pre
          style={{
            background: "#f5f5f5",
            border: "1px solid #ccc",
            padding: "1rem",
            whiteSpace: "pre-wrap",
          }}
        >
          ✅ Response:
          {"\n"}
          {response}
        </pre>
      )}

      <hr style={{ margin: "2rem 0" }} />

      <h3>Test Flow:</h3>
      <ol>
        <li>
          <b>Login</b> → Should return user object with id, username, role
        </li>
        <li>
          <b>Me</b> → Should return same user (cookie sent automatically)
        </li>
        <li>
          <b>WSM Score</b> → Should return ranking (requires login)
        </li>
        <li>
          <b>Logout</b> → Should clear session
        </li>
        <li>
          <b>Me / WSM Score after logout</b> → Should return 401
        </li>
      </ol>
    </div>
  );
}
