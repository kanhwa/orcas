import { useState, useEffect } from "react";
import { BASE_URL, User } from "../services/api";
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

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
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
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setEditFirstName(u.first_name || "");
    setEditMiddleName(u.middle_name || "");
    setEditLastName(u.last_name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role);
    setEditStatus(u.status);
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUser(editingUser.id, {
        first_name: editFirstName,
        middle_name: editMiddleName,
        last_name: editLastName,
        email: editEmail,
        role: editRole,
        status: editStatus,
      });
      setShowEdit(false);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: AdminUser) => {
    if (u.id === user.id) {
      alert("Cannot delete yourself");
      return;
    }
    if (!confirm(`Delete user "${u.username}"?`)) return;
    try {
      await deleteUser(u.id);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to delete user");
    }
  };

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
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && users.length === 0 && (
          <p className="text-gray-500">No users found.</p>
        )}
        {!loading && users.length > 0 && (
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
              {users.map((u) => (
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
                  <td className="space-x-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEdit(u)}
                    >
                      Edit
                    </Button>
                    {u.id !== user.id && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(u)}
                      >
                        Delete
                      </Button>
                    )}
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
                  placeholder="••••••••"
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

            <div className="grid grid-cols-2 gap-4">
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
                  <p className="text-xs text-orange-600 mt-1">
                    Maximum 2 admins reached
                  </p>
                )}
              </div>
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

      {/* Edit User Modal */}
      {showEdit && editingUser && (
        <Modal
          title={`Edit User: ${editingUser.username}`}
          onClose={() => setShowEdit(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editMiddleName}
                  onChange={(e) => setEditMiddleName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <Select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={editingUser.id === user.id}
                >
                  <option value="employee">Employee</option>
                  {(canCreateAdmin || editingUser.role === "admin") && (
                    <option value="admin">Admin</option>
                  )}
                </Select>
                {editingUser.id === user.id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Cannot change your own role
                  </p>
                )}
                {!canCreateAdmin && editingUser.role !== "admin" && (
                  <p className="text-xs text-orange-600 mt-1">
                    Max 2 admins reached
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <Select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
