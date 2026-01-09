import { FormEvent, useState, ChangeEvent, useRef } from "react";
import {
  User,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  BASE_URL,
} from "../services/api";
import { AvatarBadge } from "../components/AvatarBadge";
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

  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

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

    const nextUsername = username.trim();
    if (!nextUsername) {
      setProfileErr("Username is required.");
      return;
    }

    setProfileLoading(true);
    try {
      const usernameChanged = nextUsername !== user.username;
      const updated = await updateProfile({
        username: nextUsername,
        first_name: firstName.trim() || undefined,
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim() || undefined,
      });
      onUserUpdate(updated);
      setUsername(updated.username);
      setFirstName(updated.first_name ?? "");
      setMiddleName(updated.middle_name ?? "");
      setLastName(updated.last_name ?? "");
      setEmail(updated.email ?? "");
      if (usernameChanged) {
        setProfileMsg(
          "Username updated. Please log out and log in again using the new username."
        );
      } else {
        setProfileMsg("Profile updated.");
      }
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setProfileErr(e.detail || "Profile update failed.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarErr(null);
    setAvatarMsg(null);

    const allowed = ["image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      setAvatarErr("Only PNG or JPG files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > 1024 * 1024) {
      setAvatarErr("Avatar must be 1 MB or smaller.");
      e.target.value = "";
      return;
    }

    setAvatarLoading(true);
    try {
      const updated = await uploadAvatar(file);
      onUserUpdate(updated);
      setAvatarMsg("Avatar updated.");
    } catch (err: unknown) {
      const e2 = err as { detail?: string };
      setAvatarErr(e2.detail || "Avatar upload failed.");
    } finally {
      setAvatarLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAvatar = async () => {
    setAvatarErr(null);
    setAvatarMsg(null);
    setAvatarLoading(true);
    try {
      const updated = await deleteAvatar();
      onUserUpdate(updated);
      setAvatarMsg("Avatar removed.");
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setAvatarErr(e.detail || "Failed to remove avatar.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const avatarInputId = "avatar-upload";

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <AvatarBadge
              username={user.username}
              avatarUrl={
                user.avatar_url
                  ? user.avatar_url.startsWith("http")
                    ? user.avatar_url
                    : `${BASE_URL}${user.avatar_url}`
                  : null
              }
              size="lg"
            />
            <div className="space-y-1">
              <div className="text-sm text-[rgb(var(--color-text-subtle))]">
                Display name
              </div>
              <div className="text-base font-semibold text-[rgb(var(--color-text))]">
                {user.full_name || user.username}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <input
              ref={avatarInputRef}
              id={avatarInputId}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleAvatarChange}
              className="sr-only"
              disabled={avatarLoading}
            />
            <div className="flex gap-2 flex-wrap sm:justify-end">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarLoading ? "Uploading..." : "Upload Avatar"}
              </Button>
              {user.avatar_url && (
                <Button
                  type="button"
                  variant="danger"
                  className="w-full sm:w-auto"
                  disabled={avatarLoading}
                  onClick={handleDeleteAvatar}
                >
                  Remove
                </Button>
              )}
            </div>
            {avatarErr && (
              <span className="text-sm text-red-700">{avatarErr}</span>
            )}
            {avatarMsg && (
              <span className="text-sm text-green-700">{avatarMsg}</span>
            )}
          </div>
        </div>

        <dl className="mb-4 grid grid-cols-1 gap-3 text-sm text-[rgb(var(--color-text))] sm:grid-cols-3">
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
