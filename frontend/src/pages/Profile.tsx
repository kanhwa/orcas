import { FormEvent, useState } from "react";
import { User, updateProfile, changePassword } from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import InfoTip from "../components/InfoTip";

interface ProfileProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function Profile({ user, onUserUpdate }: ProfileProps) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [company, setCompany] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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
    setProfileLoading(true);
    try {
      const updated = await updateProfile({
        full_name: fullName.trim() || null,
        company: company.trim() || null,
      });
      onUserUpdate(updated);
      setProfileMsg("Profile updated.");
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setProfileErr(
        e.detail ||
          "Profile update failed. Backend may not support this endpoint."
      );
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

    setPwdLoading(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdMsg("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setPwdErr(
        e.detail ||
          "Password change failed. Backend may not support this endpoint."
      );
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="text-lg font-semibold text-[rgb(var(--color-text))]">
            Profile
          </div>
        }
      >
        <p className="mb-3 text-sm text-[rgb(var(--color-text-subtle))]">
          Manage your account details. Session is cookie-based; role comes from
          server.
        </p>

        <dl className="mb-4 grid grid-cols-1 gap-3 text-sm text-[rgb(var(--color-text))] sm:grid-cols-2">
          <div>
            <dt className="text-[rgb(var(--color-text-subtle))]">Username</dt>
            <dd className="font-semibold">{user.username}</dd>
          </div>
          <div>
            <dt className="text-[rgb(var(--color-text-subtle))]">Role</dt>
            <dd className="font-semibold capitalize">{user.role}</dd>
          </div>
          <div>
            <dt className="text-[rgb(var(--color-text-subtle))]">Status</dt>
            <dd className="font-semibold capitalize">{user.status}</dd>
          </div>
        </dl>

        <form className="space-y-3" onSubmit={handleProfileSubmit}>
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Full name
              <InfoTip content="Saved to server if supported." />
            </label>
            <input
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={profileLoading}
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Company
              <InfoTip content="Displayed locally; backend schema does not yet store this." />
            </label>
            <input
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Optional"
              disabled={profileLoading}
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

          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={profileLoading}
          >
            {profileLoading ? "Saving..." : "Save profile"}
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
              Current password
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
              New password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-[rgb(var(--color-text))] focus:border-[rgb(var(--color-primary))] focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={pwdLoading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-[rgb(var(--color-text-muted))]">
              Confirm new password
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
            {pwdLoading ? "Updating..." : "Change password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
