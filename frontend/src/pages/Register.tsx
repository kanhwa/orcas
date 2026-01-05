import { FormEvent, useState } from "react";
import { authRegister, RegisterRequest, User } from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface RegisterProps {
  onRegistered: (user?: User) => void;
  onCancel: () => void;
}

export default function Register({ onRegistered, onCancel }: RegisterProps) {
  const [form, setForm] = useState<RegisterRequest>({
    username: "",
    password: "",
    full_name: "",
    company: "",
  });
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (
    field: keyof RegisterRequest,
    value: string | null | undefined
  ) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const user = await authRegister(form);
      setSuccess("Registration successful. Please log in.");
      onRegistered(user);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Registration failed. Please try again.");
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
              Create an Account
            </div>
          }
        >
          <p className="mb-4 text-sm text-[rgb(var(--color-text-subtle))]">
            Registration expects backend support at /api/auth/register
            (cookie-based session).
          </p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Username
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Full name
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={form.full_name ?? ""}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="Optional"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Company
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={form.company ?? ""}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="Optional"
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
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Confirm Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
            {success && (
              <p
                className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
                role="status"
              >
                {success}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm text-[rgb(var(--color-text-subtle))]">
            <span>Already have an account?</span>
            <button
              type="button"
              className="font-semibold text-[rgb(var(--color-primary))] hover:underline"
              onClick={onCancel}
              disabled={loading}
            >
              Back to Login
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
