import { useState, FormEvent } from "react";
import { authLogin, authMe, BASE_URL, User } from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authLogin(username, password);
      const user = await authMe();
      onLoginSuccess(user);
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string };
      if (err instanceof Error && err.message === "Failed to fetch") {
        setError(`Cannot reach API at ${BASE_URL} (failed to fetch)`);
      } else if (typeof e?.status === "number") {
        setError(`HTTP ${e.status}: ${e.detail || "Login failed."}`);
      } else {
        setError(e.detail || "Login failed. Check username and password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--color-surface))] p-4">
      <div className="w-full max-w-md">
        <Card
          header={
            <div className="text-xl font-semibold text-[rgb(var(--color-text))]">
              Sign in to ORCAS
            </div>
          }
        >
          <p className="mb-4 text-sm text-[rgb(var(--color-text-subtle))]">
            Bank Stock Ranking System - Please sign in with your account
          </p>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Username
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : "Login"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-[rgb(var(--color-text-subtle))]">
            <p>Need an account? Contact an administrator.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
