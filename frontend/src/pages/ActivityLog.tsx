import { useState, useEffect, useCallback } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";


import { BASE_URL, User } from "../services/api";

// =============================================================================
// Types
// =============================================================================

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  user_role: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditLogListResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface AuditLogFilters {
  actions: string[];
  target_types: string[];
}

interface AdminUser {
  id: number;
  username: string;
  role: string;
}

interface UserListResponse {
  users: AdminUser[];
}

// =============================================================================
// API Functions
// =============================================================================

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

async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  user_id?: number | null;
  action?: string | null;
  target_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  search?: string | null;
  sort_by?: string;
  sort_order?: string;
}): Promise<AuditLogListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.user_id) searchParams.set("user_id", String(params.user_id));
  if (params.action) searchParams.set("action", params.action);
  if (params.target_type) searchParams.set("target_type", params.target_type);
  if (params.start_date) searchParams.set("start_date", params.start_date);
  if (params.end_date) searchParams.set("end_date", params.end_date);
  if (params.search) searchParams.set("search", params.search);
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);

  return request<AuditLogListResponse>(
    `/api/admin/audit-logs?${searchParams.toString()}`
  );
}

async function getAuditLogFilters(): Promise<AuditLogFilters> {
  return request<AuditLogFilters>("/api/admin/audit-logs/filters");
}

async function getUsers(): Promise<UserListResponse> {
  return request<UserListResponse>("/api/admin/users?limit=100");
}

async function exportAuditLogs(params: {
  user_id?: number | null;
  action?: string | null;
  target_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  search?: string | null;
}): Promise<void> {
  const searchParams = new URLSearchParams();
  if (params.user_id) searchParams.set("user_id", String(params.user_id));
  if (params.action) searchParams.set("action", params.action);
  if (params.target_type) searchParams.set("target_type", params.target_type);
  if (params.start_date) searchParams.set("start_date", params.start_date);
  if (params.end_date) searchParams.set("end_date", params.end_date);
  if (params.search) searchParams.set("search", params.search);

  const response = await fetch(
    `${BASE_URL}/api/admin/audit-logs/export?${searchParams.toString()}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    throw new Error("Export failed");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// =============================================================================
// Helpers
// =============================================================================

const ACTION_CONFIG: Record<
  string,
  { icon: string; label: string; color: "green" | "amber" | "red" | "gray" }
> = {
  login_success: { icon: "✅", label: "Login Success", color: "green" },
  login_failed: { icon: "❌", label: "Login Failed", color: "red" },
  logout: { icon: "🚪", label: "Logout", color: "gray" },
  password_changed: { icon: "🔑", label: "Password Changed", color: "amber" },
  user_created: { icon: "👤", label: "User Created", color: "green" },
  user_updated: { icon: "✏️", label: "User Updated", color: "amber" },
  user_deleted: { icon: "🗑️", label: "User Deleted", color: "red" },
  user_password_reset: { icon: "🔐", label: "Password Reset", color: "amber" },
  user_username_changed: { icon: "📝", label: "Username Changed", color: "amber" },
  data_imported: { icon: "📥", label: "Data Imported", color: "green" },
};

function getActionConfig(action: string) {
  return (
    ACTION_CONFIG[action] || {
      icon: "📌",
      label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      color: "gray" as const,
    }
  );
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

// =============================================================================
// Components
// =============================================================================

function ActionBadge({ action }: { action: string }) {
  const config = getActionConfig(action);
  const colorClasses = {
    green: "bg-green-100 text-green-800 border-green-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-red-100 text-red-800 border-red-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses[config.color]}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const isAdmin = role === "admin";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        isAdmin
          ? "bg-purple-100 text-purple-800"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {role}
    </span>
  );
}

function JsonViewer({ data }: { data: Record<string, unknown> | null }) {
  const [copied, setCopied] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return <span className="text-gray-400 text-sm italic">No details</span>;
  }

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto max-h-64">
        <code className="text-gray-800">{jsonString}</code>
      </pre>
    </div>
  );
}

function LogCard({
  log,
  isExpanded,
  onToggleExpand,
}: {
  log: AuditLogEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <div className="bg-white border border-[rgb(var(--color-border))] rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <ActionBadge action={log.action} />
        <span
          className="text-xs text-gray-500 cursor-help"
          title={formatDateTime(log.created_at)}
        >
          {getRelativeTime(log.created_at)}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* User info */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">👤</span>
          <span className="font-medium text-gray-900">
            {log.username || "System"}
          </span>
          <RoleBadge role={log.user_role} />
        </div>

        {/* Target info */}
        {log.target_type && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>🎯</span>
            <span>
              Target: {log.target_type}
              {log.target_id && ` #${log.target_id}`}
            </span>
          </div>
        )}

        {/* IP Address */}
        {log.ip_address && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>🌐</span>
            <span className="font-mono">{log.ip_address}</span>
          </div>
        )}

        {/* Details toggle */}
        {hasDetails && (
          <button
            onClick={onToggleExpand}
            className="text-sm text-[rgb(var(--color-primary))] hover:underline flex items-center gap-1"
          >
            <span>{isExpanded ? "▼" : "▶"}</span>
            <span>{isExpanded ? "Hide details" : "Show details"}</span>
          </button>
        )}

        {/* Expanded details */}
        {isExpanded && hasDetails && (
          <div className="mt-2">
            <JsonViewer data={log.details} />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPanel({
  users,
  filters,
  selectedUserId,
  selectedAction,
  selectedTargetType,
  startDate,
  endDate,
  searchTerm,
  onUserChange,
  onActionChange,
  onTargetTypeChange,
  onStartDateChange,
  onEndDateChange,
  onSearchChange,
  onClearFilters,
}: {
  users: AdminUser[];
  filters: AuditLogFilters | null;
  selectedUserId: number | null;
  selectedAction: string | null;
  selectedTargetType: string | null;
  startDate: string;
  endDate: string;
  searchTerm: string;
  onUserChange: (userId: number | null) => void;
  onActionChange: (action: string | null) => void;
  onTargetTypeChange: (targetType: string | null) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSearchChange: (search: string) => void;
  onClearFilters: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hasActiveFilters =
    selectedUserId ||
    selectedAction ||
    selectedTargetType ||
    startDate ||
    endDate ||
    searchTerm;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>{isCollapsed ? "▶" : "▼"}</span>
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-[rgb(var(--color-primary))] text-white text-xs rounded-full">
              Active
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* User filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              User
            </label>
            <Select
              value={selectedUserId?.toString() || ""}
              onChange={(e) =>
                onUserChange(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({user.role})
                </option>
              ))}
            </Select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Action
            </label>
            <Select
              value={selectedAction || ""}
              onChange={(e) => onActionChange(e.target.value || null)}
            >
              <option value="">All actions</option>
              {filters?.actions.map((action) => (
                <option key={action} value={action}>
                  {getActionConfig(action).label}
                </option>
              ))}
            </Select>
          </div>

          {/* Target type filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Target Type
            </label>
            <Select
              value={selectedTargetType || ""}
              onChange={(e) => onTargetTypeChange(e.target.value || null)}
            >
              <option value="">All types</option>
              {filters?.target_types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-sm"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="IP or details..."
              className="w-full rounded-lg border border-[rgb(var(--color-border))] bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{start}</span> -{" "}
        <span className="font-medium">{end}</span> of{" "}
        <span className="font-medium">{total}</span> logs
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show:</span>
          <Select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="w-20"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </Select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-600 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface ActivityLogProps {
  user: User;
}

export default function ActivityLog({ user: _user }: ActivityLogProps) {
  void _user;

  // Data state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter options
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters | null>(null);

  // Filter state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedTargetType, setSelectedTargetType] = useState<string | null>(
    null
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination & sorting
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [usersRes, filtersRes] = await Promise.all([
          getUsers(),
          getAuditLogFilters(),
        ]);
        setUsers(usersRes.users);
        setFilters(filtersRes);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    };
    loadFilterOptions();
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAuditLogs({
        page,
        limit,
        user_id: selectedUserId,
        action: selectedAction,
        target_type: selectedTargetType,
        start_date: startDate ? `${startDate}T00:00:00Z` : null,
        end_date: endDate ? `${endDate}T23:59:59Z` : null,
        search: debouncedSearch || null,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    selectedUserId,
    selectedAction,
    selectedTargetType,
    startDate,
    endDate,
    debouncedSearch,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchLogs]);

  // Handlers
  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSelectedUserId(null);
    setSelectedAction(null);
    setSelectedTargetType(null);
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAuditLogs({
        user_id: selectedUserId,
        action: selectedAction,
        target_type: selectedTargetType,
        start_date: startDate ? `${startDate}T00:00:00Z` : null,
        end_date: endDate ? `${endDate}T23:59:59Z` : null,
        search: debouncedSearch || null,
      });
    } catch (err) {
      console.error("Export failed:", err);
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text))]">
            📋 Activity Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all system events and user actions
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-600">Auto-refresh</span>
            </label>
            {autoRefresh && (
              <Select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-20"
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </Select>
            )}
          </div>

          {/* Export button */}
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting || loading}
          >
            {exporting ? "Exporting..." : "📥 Export CSV"}
          </Button>

          {/* Refresh button */}
          <Button variant="ghost" onClick={fetchLogs} disabled={loading}>
            🔄
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        users={users}
        filters={filters}
        selectedUserId={selectedUserId}
        selectedAction={selectedAction}
        selectedTargetType={selectedTargetType}
        startDate={startDate}
        endDate={endDate}
        searchTerm={searchTerm}
        onUserChange={(id) => {
          setSelectedUserId(id);
          setPage(1);
        }}
        onActionChange={(action) => {
          setSelectedAction(action);
          setPage(1);
        }}
        onTargetTypeChange={(type) => {
          setSelectedTargetType(type);
          setPage(1);
        }}
        onStartDateChange={(date) => {
          setStartDate(date);
          setPage(1);
        }}
        onEndDateChange={(date) => {
          setEndDate(date);
          setPage(1);
        }}
        onSearchChange={setSearchTerm}
        onClearFilters={handleClearFilters}
      />

      {/* Sort controls */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">Sort by:</span>
        {[
          { field: "created_at", label: "Time" },
          { field: "user_id", label: "User" },
          { field: "action", label: "Action" },
        ].map(({ field, label }) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`px-3 py-1 rounded-full border transition ${
              sortBy === field
                ? "bg-[rgb(var(--color-primary))] text-white border-[rgb(var(--color-primary))]"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            {label}
            {sortBy === field && (
              <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && logs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-500">Loading audit logs...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-600 mb-4">No audit logs found</p>
            <Button variant="ghost" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        </Card>
      )}

      {/* Log cards grid */}
      {logs.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {logs.map((log) => (
              <LogCard
                key={log.id}
                log={log}
                isExpanded={expandedIds.has(log.id)}
                onToggleExpand={() => handleToggleExpand(log.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
