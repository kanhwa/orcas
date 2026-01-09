import { useState, useEffect } from "react";
import {
  BASE_URL,
  User,
  adminResetPassword,
  adminEditUsername,
} from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";

// Admin API types
interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface UserListResponse {
  total: number;
  admin_count: number;
  users: AdminUser[];
}

interface AdminCountResponse {
  admin_count: number;
  max_admins: number;
  can_create_admin: boolean;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw { status: response.status, detail: err.detail || "Unknown error" };
  }
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

async function getUsers(skip = 0, limit = 50): Promise<UserListResponse> {
  return request<UserListResponse>(
    `/api/admin/users?skip=${skip}&limit=${limit}`
  );
}

async function getAdminCount(): Promise<AdminCountResponse> {
  return request<AdminCountResponse>(`/api/admin/admin-count`);
}

async function createUser(data: {
  username: string;
  password: string;
  email?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  role: string;
}): Promise<AdminUser> {
  return request<AdminUser>(`/api/admin/users`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateUser(
  userId: number,
  data: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
    status?: string;
  }
): Promise<AdminUser> {
  return request<AdminUser>(`/api/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteUser(userId: number): Promise<void> {
  return request<void>(`/api/admin/users/${userId}`, { method: "DELETE" });
}

// Sorting function: admins first, then by username (case-insensitive), fallback to id
function sortUsers(users: AdminUser[]): AdminUser[] {
  return [...users].sort((a, b) => {
    // 1) Role priority: admin = 0, employee = 1
    const rolePriorityA = a.role === "admin" ? 0 : 1;
    const rolePriorityB = b.role === "admin" ? 0 : 1;
    if (rolePriorityA !== rolePriorityB) {
      return rolePriorityA - rolePriorityB;
    }
    // 2) Within same role, sort by username (case-insensitive)
    const usernameCompare = a.username
      .toLowerCase()
      .localeCompare(b.username.toLowerCase());
    if (usernameCompare !== 0) {
      return usernameCompare;
    }
    // 3) Fallback: id ascending
    return a.id - b.id;
  });
}

interface AdminProps {
  user: User;
}

export default function Admin({ user }: AdminProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [canCreateAdmin, setCanCreateAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newMiddleName, setNewMiddleName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState("employee");
  const [creating, setCreating] = useState(false);

  // Edit User modal (comprehensive)
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<
    "account" | "profile" | "security" | "danger"
  >("account");

  // Account tab
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Profile tab
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Security tab
  const [newPasswordEdit, setNewPasswordEdit] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Danger zone
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getUsers();
      setUsers(res.users);
      setTotal(res.total);
      setAdminCount(res.admin_count);

      const countRes = await getAdminCount();
      setCanCreateAdmin(countRes.can_create_admin);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const resetCreateForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewEmail("");
    setNewFirstName("");
    setNewMiddleName("");
    setNewLastName("");
    setNewRole("employee");
  };

  const handleCreate = async () => {
    if (!newUsername || !newPassword || !newFirstName || !newLastName) {
      alert("Please fill in all required fields");
      return;
    }
    setCreating(true);
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        email: newEmail || undefined,
        first_name: newFirstName,
        middle_name: newMiddleName || undefined,
        last_name: newLastName,
        role: newRole,
      });
      setShowCreate(false);
      resetCreateForm();
      setSuccessMsg("User created successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditFirstName(u.first_name || "");
    setEditMiddleName(u.middle_name || "");
    setEditLastName(u.last_name || "");
    setEditEmail(u.email || "");
    setNewPasswordEdit("");
    setConfirmPassword("");
    setDeleteConfirmation("");
    setActiveTab("account");
    setModalError("");
    setModalSuccess("");
    setShowEditUser(true);
  };

  const handleSaveAccount = async () => {
    if (!editingUser) return;
    setModalError("");
    setModalSuccess("");
    setSaving(true);

    try {
      // Update username if changed
      if (editUsername !== editingUser.username) {
        await adminEditUsername(editingUser.id, editUsername);
      }

      // Update role/status
      await updateUser(editingUser.id, {
        role: editRole,
        status: editStatus,
      });

      setModalSuccess("Account settings updated successfully.");
      setTimeout(() => setModalSuccess(""), 3000);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setModalError(e.detail || "Failed to update account settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    setModalError("");
    setModalSuccess("");
    setSaving(true);

    try {
      await updateUser(editingUser.id, {
        first_name: editFirstName,
        middle_name: editMiddleName || undefined,
        last_name: editLastName,
        email: editEmail || undefined,
      });

      setModalSuccess("Profile updated successfully.");
      setTimeout(() => setModalSuccess(""), 3000);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setModalError(e.detail || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;
    setModalError("");
    setModalSuccess("");

    if (!newPasswordEdit) {
      setModalError("Password cannot be empty.");
      return;
    }

    if (newPasswordEdit !== confirmPassword) {
      setModalError("Passwords do not match.");
      return;
    }

    if (newPasswordEdit.length < 6) {
      setModalError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      await adminResetPassword(editingUser.id, newPasswordEdit);
      setModalSuccess("Password reset successfully.");
      setNewPasswordEdit("");
      setConfirmPassword("");
      setTimeout(() => setModalSuccess(""), 3000);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setModalError(e.detail || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;
    setModalError("");

    if (editingUser.id === user.id) {
      setModalError("Cannot delete yourself.");
      return;
    }

    // Check if trying to delete last admin
    if (
      editingUser.role === "admin" &&
      editingUser.status === "active" &&
      adminCount <= 1
    ) {
      setModalError("Cannot delete the last active admin.");
      return;
    }

    if (
      deleteConfirmation !== editingUser.username &&
      deleteConfirmation !== "DELETE"
    ) {
      setModalError(`Type "${editingUser.username}" or "DELETE" to confirm.`);
      return;
    }

    setSaving(true);
    try {
      await deleteUser(editingUser.id);
      setShowEditUser(false);
      setSuccessMsg("User deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setModalError(e.detail || "Failed to delete user.");
    } finally {
      setSaving(false);
    }
  };

  const sortedUsers = sortUsers(users);

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-semibold">User Management</span>
              <div className="text-sm text-gray-500 mt-1">
                Total: {total} users • Admins: {adminCount}/2
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)}>+ Create User</Button>
          </div>
        }
      >
        {successMsg && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            {successMsg}
          </div>
        )}
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && users.length === 0 && (
          <p className="text-gray-500">No users found.</p>
        )}
        {!loading && sortedUsers.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td className="font-medium">{u.username}</td>
                  <td>{u.full_name || "-"}</td>
                  <td className="text-sm">{u.email || "-"}</td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        u.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditUser(u)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Create User Modal */}
      {showCreate && (
        <Modal
          title="Create New User"
          onClose={() => {
            setShowCreate(false);
            resetCreateForm();
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newMiddleName}
                  onChange={(e) => setNewMiddleName(e.target.value)}
                  placeholder="(optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="employee">Employee</option>
                {canCreateAdmin && <option value="admin">Admin</option>}
              </Select>
              {!canCreateAdmin && (
                <p className="text-xs text-gray-500 mt-1">
                  Maximum {2} admins allowed
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User Modal (Comprehensive) */}
      {showEditUser && editingUser && (
        <Modal
          title={`Edit User: ${editingUser.username}`}
          onClose={() => setShowEditUser(false)}
        >
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex border-b">
              <button
                className={`px-4 py-2 font-medium ${
                  activeTab === "account"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("account")}
              >
                Account
              </button>
              <button
                className={`px-4 py-2 font-medium ${
                  activeTab === "profile"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("profile")}
              >
                Profile
              </button>
              <button
                className={`px-4 py-2 font-medium ${
                  activeTab === "security"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("security")}
              >
                Security
              </button>
              <button
                className={`px-4 py-2 font-medium ${
                  activeTab === "danger"
                    ? "border-b-2 border-red-500 text-red-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("danger")}
              >
                Danger Zone
              </button>
            </div>

            {modalError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                {modalSuccess}
              </div>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <Select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={saving}
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </Select>
                  {editRole === "admin" &&
                    adminCount >= 2 &&
                    editingUser.role !== "admin" && (
                      <p className="text-xs text-amber-600 mt-1">
                        Warning: Maximum 2 admins allowed. Promoting may fail.
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <Select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={saving}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => setShowEditUser(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveAccount} disabled={saving}>
                    {saving ? "Saving..." : "Save Account"}
                  </Button>
                </div>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={editMiddleName}
                      onChange={(e) => setEditMiddleName(e.target.value)}
                      placeholder="(optional)"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="user@example.com"
                    disabled={saving}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => setShowEditUser(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Set a new password for this user. Old passwords are never
                  shown.
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={newPasswordEdit}
                    onChange={(e) => setNewPasswordEdit(e.target.value)}
                    placeholder="At least 6 characters"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    disabled={saving}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => setShowEditUser(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleResetPassword} disabled={saving}>
                    {saving ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>
              </div>
            )}

            {/* Danger Zone Tab */}
            {activeTab === "danger" && (
              <div className="space-y-4">
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Warning: This action cannot be undone. This will permanently
                  delete the user account.
                </div>

                {editingUser.id === user.id && (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    You cannot delete your own account.
                  </div>
                )}

                {editingUser.role === "admin" &&
                  editingUser.status === "active" &&
                  adminCount <= 1 && (
                    <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      Cannot delete the last active admin.
                    </div>
                  )}

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Type <strong>{editingUser.username}</strong> or{" "}
                    <strong>DELETE</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type to confirm deletion"
                    disabled={saving || editingUser.id === user.id}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => setShowEditUser(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDeleteUser}
                    disabled={
                      saving ||
                      editingUser.id === user.id ||
                      (editingUser.role === "admin" &&
                        editingUser.status === "active" &&
                        adminCount <= 1)
                    }
                  >
                    {saving ? "Deleting..." : "Delete User"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
