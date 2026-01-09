import { FormEvent, useState } from "react";
import { User, updateProfile, changePassword } from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface ProfileProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function Profile({ user, onUserUpdate }: ProfileProps) {
  const [username, setUsername] = useState(user.username);
  const [firstName, setFirstName] = useState(user.first_name ?? "");
  const [middleName, setMiddleName] = useState(user.middle_name ?? "");
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [usernameChanged, setUsernameChanged] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    setUsernameChanged(false);
    setProfileLoading(true);
    const usernameWillChange = username.trim() !== user.username;
    try {
      const updated = await updateProfile({
        username: username.trim() || undefined,
        first_name: firstName.trim() || undefined,
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim() || undefined,
      });
      onUserUpdate(updated);
      setProfileMsg("Profile updated.");
      if (usernameWillChange) {
        setUsernameChanged(true);
      }
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setProfileErr(e.detail || "Profile update failed.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);

    if (newPassword !== confirmPassword) {
      setPwdErr("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPwdErr("Password must be at least 6 characters.");
      return;
    }

    setPwdLoading(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setPwdErr(e.detail || "Password change failed.");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="text-lg font-semibold text-[rgb(var(--color-text))]">
            My Profile
          </div>
        }
      >
        <dl className="mb-4 grid grid-cols-1 gap-3 text-sm text-[rgb(var(--color-text))] sm:grid-cols-2">
          <div>
            <dt className="text-[rgb(var(--color-text-subtle))]">Role</dt>
            <dd className="font-semibold capitalize">{user.role}</dd>
          </div>
          <div>
            <dt className="text-[rgb(var(--color-text-subtle))]">Status</dt>
            <dd>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  user.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {user.status}
              </span>
            </dd>
          </div>
        </dl>

        <form className="space-y-4" onSubmit={handleProfileSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Username
            </label>
            <input
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={profileLoading}
              placeholder="username"
              minLength={3}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                First Name
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={profileLoading}
                placeholder="John"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Middle Name
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                disabled={profileLoading}
                placeholder="(optional)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
                Last Name
              </label>
              <input
                className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={profileLoading}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={profileLoading}
              placeholder="user@example.com"
            />
          </div>

          {profileErr && (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {profileErr}
            </p>
          )}
          {profileMsg && (
            <p
              className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
              role="status"
            >
              {profileMsg}
            </p>
          )}
          {usernameChanged && (
            <p
              className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
              role="status"
            >
              ℹ️ Username updated. Please log out and log in again using the new username.
            </p>
          )}

          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={profileLoading}
          >
            {profileLoading ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </Card>

      <Card
        header={
          <div className="text-lg font-semibold text-[rgb(var(--color-text))]">
            Change Password
          </div>
        }
      >
        <form className="space-y-3" onSubmit={handlePasswordSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Current Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={pwdLoading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              New Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={pwdLoading}
              minLength={6}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Confirm New Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={pwdLoading}
            />
          </div>

          {pwdErr && (
            <p
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {pwdErr}
            </p>
          )}
          {pwdMsg && (
            <p
              className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
              role="status"
            >
              {pwdMsg}
            </p>
          )}

          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={pwdLoading}
          >
            {pwdLoading ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
