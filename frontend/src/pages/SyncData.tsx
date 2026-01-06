import { useState, useEffect, useRef } from "react";
import { User } from "../services/api";
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

const API_BASE = "http://localhost:8000";

export default function SyncData({ user: _ }: SyncDataProps) {
  const [files, setFiles] = useState<CsvFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sync-data/files`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch files");
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/sync-data/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Upload failed");
      }

      const result = await res.json();
      setSuccessMsg(result.message);
      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/sync-data/files/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Delete failed");
      }

      setSuccessMsg(`File ${filename} deleted successfully`);
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
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-[rgb(var(--color-text))]">
                Sync Data
              </h2>
              <p className="text-sm text-[rgb(var(--color-text-subtle))] mt-1">
                Upload dan kelola file data CSV untuk laporan tahunan
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={fetchFiles}
                disabled={loading}
              >
                🔄 Refresh
              </Button>
              <label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button disabled={uploading}>
                  {uploading ? "⏳ Uploading..." : "📤 Upload CSV"}
                </Button>
              </label>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>📝 Format nama file:</strong> Nama file harus dalam format{" "}
            <code className="bg-blue-100 px-1 rounded">YYYY.csv</code> (contoh:
            2024.csv, 2025.csv)
          </div>
        </div>
      </Card>

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
            ℹ️ Informasi
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-[rgb(var(--color-text-subtle))]">
            <li>File CSV berisi data laporan keuangan emiten bank per tahun</li>
            <li>
              Nama file harus dalam format <strong>YYYY.csv</strong> (contoh:
              2024.csv)
            </li>
            <li>
              File yang sudah ada akan ditimpa jika mengupload dengan nama yang
              sama
            </li>
            <li>
              Data yang diupload akan langsung tersedia untuk analisis di
              fitur-fitur lainnya
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
