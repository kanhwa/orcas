import { useState, useEffect, useRef } from "react";
import { BASE_URL, User } from "../services/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface CsvFileInfo {
  filename: string;
  year: number | null;
  size: number;
  modified_at: string;
}

interface SyncDataProps {
  user: User;
}

export default function SyncData({ user: _ }: SyncDataProps) {
  const [files, setFiles] = useState<CsvFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let warningTimeout: ReturnType<typeof setTimeout>;
    if (warningMsg) {
      warningTimeout = setTimeout(() => {
        setWarningMsg(null);
      }, 25000);
    }
    return () => {
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [warningMsg]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (successMsg || error || deleteMsg) {
      timeoutId = setTimeout(() => {
        setSuccessMsg(null);
        setError(null);
        if (typeof setDeleteMsg === "function") setDeleteMsg(null);
      }, 5000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [successMsg, error, deleteMsg]);
  
  const [stats, setStats] = useState<{
    total_banks: number;
    total_metrics: number;
    total_sections: number;
    total_years: number;
    total_expected_cells: number;
    total_missing: number;
  } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);


  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/files`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch files");
      }
      const data = await res.json();
      setFiles(data.files || []);
      
      const statsRes = await fetch(`${BASE_URL}/api/sync-data/stats`, {
        credentials: "include",
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const validateAndUpload = async (file: File) => {
    // Validate file extension
    if (!file.name.endsWith(".csv")) {
      setError("File must be a CSV file (.csv extension required)");
      return;
    }

    // Validate MIME type
    if (!file.type.includes("csv") && file.type !== "text/plain") {
      setError("File must be a CSV file (text/csv or text/plain MIME type)");
      return;
    }

    // Optional: validate max file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("[ERR-04] Ukuran File Ditolak: Maksimal ukuran file adalah 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);
        if (typeof setDeleteMsg === "function") setDeleteMsg(null);
    setSuccessMsg(null);
    if (typeof setDeleteMsg === 'function') setDeleteMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("import_to_db", "true");

      const res = await fetch(`${BASE_URL}/api/sync-data/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Upload failed");
      }

      const result = await res.json();
      setSuccessMsg(
        result.message || `File ${file.name} uploaded successfully`
      );
      if (result.warning) {
        setWarningMsg(result.warning);
      }
      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await validateAndUpload(file);

    // Reset input value to allow re-uploading the same file
    e.target.value = "";
  };

  const handleUploadClick = () => {
    // Synchronously trigger the file picker - must happen in user gesture context
    fileInputRef.current?.click();
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    setError(null);
    setSuccessMsg(null);
    setDeleteMsg(null);

    try {
      const res = await fetch(
        `${BASE_URL}/api/sync-data/files/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Delete failed");
      }

      const data = await res.json();
      setDeleteMsg(data.detail || `File ${filename} deleted successfully`);
      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`space-y-4 relative ${uploading ? 'pointer-events-none' : ''}`}>
      {/* Loading Overlay */}
      {uploading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-lg">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-[rgb(var(--color-primary))] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-semibold text-gray-700">Loading... Importing data</p>
          </div>
        </div>
      )}

      {/* Action Buttons & Sync Date */}
      <div className="flex justify-between items-end">
        <div className="text-sm text-gray-500 font-medium">
          {lastRefreshed && `Dataset synchronized as of: ${lastRefreshed.toLocaleString('en-US')}`}
        </div>
        <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={fetchFiles}
          disabled={loading}
        >
          🔄 Refresh
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFilePicked}
          style={{ display: "none" }}
        />
        <Button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? "⏳ Uploading..." : "📤 Upload CSV"}
        </Button>
        <span className="text-xs text-gray-500 self-center">
          CSV only
        </span>
      </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMsg}
        </div>
      )}
      {deleteMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          🗑️ {deleteMsg}
        </div>
      )}
      {warningMsg && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-start justify-between gap-2 shadow-sm">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <p className="font-medium pt-0.5">{warningMsg}</p>
          </div>
          <button 
            onClick={() => setWarningMsg(null)}
            className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 p-1 rounded transition-colors"
            title="Tutup Peringatan"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dataset Summary Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-green-600/30 shadow-sm">
            <div className="p-4 flex flex-col justify-center items-center text-center h-full">
              <div className="text-3xl mb-2">🏦</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total_banks}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Bank Stocks</div>
            </div>
          </Card>
          <Card className="border-2 border-green-600/30 shadow-sm">
            <div className="p-4 flex flex-col justify-center items-center text-center h-full">
              <div className="text-3xl mb-2">📌</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total_metrics}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Metrics ({stats.total_sections} Sections)</div>
            </div>
          </Card>
          <Card className="border-2 border-green-600/30 shadow-sm">
            <div className="p-4 flex flex-col justify-center items-center text-center h-full">
              <div className="text-3xl mb-2">🗂️</div>
              <div className="text-2xl font-bold text-gray-800">{stats.total_expected_cells.toLocaleString()}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Data Cells ({stats.total_years} Years)</div>
            </div>
          </Card>
          <Card className="border-2 border-green-600/30 shadow-sm">
            <div className="p-4 flex flex-col justify-center items-center text-center h-full">
              <div className="text-3xl mb-2">{stats.total_missing > 0 ? "‼️" : "✅"}</div>
              <div className="text-2xl font-bold text-red-600">{stats.total_missing.toLocaleString()}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">Missing Values (NULL)</div>
            </div>
          </Card>
        </div>
      )}
      


      {/* Files List */}
      <Card>
        <div className="card-body">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text))] mb-4">
            📁 Data Files ({files.length})
          </h3>

          {loading ? (
            <div className="text-center py-8 text-[rgb(var(--color-text-subtle))]">
              Loading...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-[rgb(var(--color-text-subtle))]">
              No CSV files found. Upload a file to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--color-border))]">
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">
                      Year
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">
                      Filename
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">
                      Size
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">
                      Modified
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.filename}
                      className="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-alt))]"
                    >
                      <td className="py-3 px-4">
                        {file.year ? (
                          <span className="font-semibold text-[rgb(var(--color-primary))]">
                            📅 {file.year}
                          </span>
                        ) : (
                          <span className="text-[rgb(var(--color-text-subtle))]">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[rgb(var(--color-text))]">
                        {file.filename}
                      </td>
                      <td className="py-3 px-4 text-right text-[rgb(var(--color-text-subtle))]">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="py-3 px-4 text-[rgb(var(--color-text-subtle))]">
                        {formatDate(file.modified_at)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file.filename)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          🗑️ Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Info Card */}
      <Card>
        <div className="card-body">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text))] mb-3">
            ℹ️ Information
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-[rgb(var(--color-text-subtle))]">
            <li>CSV files contain annual financial data for bank stocks</li>
            <li>
              Filename must be in <strong>YYYY.csv</strong> format (e.g.,
              2024.csv)
            </li>
            <li>
              Existing files will be overwritten if uploading with the same name
            </li>
            <li>
              Uploaded data will be immediately available for analysis in other
              features
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
