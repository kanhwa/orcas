import { useState, useEffect } from "react";
import { User } from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";

// Admin API types
interface AdminUser {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface UserListResponse {
  total: number;
  users: AdminUser[];
}

// Admin API calls
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

async function updateUser(
  userId: number,
  data: { full_name?: string | null; role?: string; status?: string }
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
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

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditStatus(u.status);
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUser(editingUser.id, { role: editRole, status: editStatus });
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
            <span className="text-lg font-semibold">User Management</span>
            <span className="text-sm text-gray-500">Total: {total} users</span>
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
                <th>Full Name</th>
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

      {showEdit && editingUser && (
        <Modal
          title={`Edit User: ${editingUser.username}`}
          onClose={() => setShowEdit(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <Select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Select>
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
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
