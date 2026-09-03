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

  const [trashFiles, setTrashFiles] = useState<CsvFileInfo[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedTrash, setSelectedTrash] = useState<string[]>([]);
  
  const fetchTrash = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/trash`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTrashFiles(data.files || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);


  const [error, setError] = useState<string | null>(null);
  
  const [viewFile, setViewFile] = useState<{ filename: string, rows: string[][] } | null>(null);


  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [warningFile, setWarningFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warning message will now persist until explicitly dismissed via modal

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
      fetchTrash();
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
        setWarningFile(result.filename || file.name);
      }
      fetchFiles();
      fetchTrash();
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

  
  const handleRestore = async (filename: string) => {
    if (!window.confirm(`Restore ${filename}?`)) return;
    setUploading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/trash/${filename}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await fetchFiles();
        await fetchTrash();
        setSelectedTrash(selectedTrash.filter(f => f !== filename));
        setSuccessMsg(`File ${filename} successfully restored`);
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to restore file");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to restore file");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTrash = async (filename: string) => {
    if (!window.confirm(`Permanently delete ${filename}?`)) return;
    setUploading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/trash/${filename}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await fetchTrash();
        setSelectedTrash(selectedTrash.filter(f => f !== filename));
        setDeleteMsg(`File ${filename} permanently deleted`);
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to delete file");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to delete file");
    } finally {
      setUploading(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm("Empty trash completely? This cannot be undone.")) return;
    setUploading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/trash`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await fetchTrash();
        setSelectedTrash([]);
        setDeleteMsg("Trash completely emptied");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to empty trash");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to empty trash");
    } finally {
      setUploading(false);
    }
  };
  
  const toggleTrashSelection = (filename: string) => {
    setSelectedTrash(prev => 
      prev.includes(filename) ? prev.filter(f => f !== filename) : [...prev, filename]
    );
  };

  const handleUploadClick = () => {
    // Synchronously trigger the file picker - must happen in user gesture context
    fileInputRef.current?.click();
  };



  const handleDownloadTemplate = () => {
    const headers = [
      "Year", "Section", "Metric", 
      "AGRS", "ARTO", "BABP", "BACA", "BBCA", "BBKP", "BBNI", "BBRI", "BBTN", "BDMN", "BINA", "BJBR", "BJTM", "BKSW", "BMAS", "BMRI", "BNBA", "BNGA", "BNII", "BNLI", "BSIM", "BTPN", "BTPS", "CCB", "MEGA", "NISP", "NOBU", "PNBN", "SDRA"
    ];
    
    const rows = [
      ["20YY", "BALANCE SHEET", "Total Assets", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Total Liabilities", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Total Equity", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Customer Deposits", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Fixed Assets", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Cash and Cash Equivalents", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Loans Given", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Loans Received", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Placements with Bank Indonesia", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Giro at Bank Indonesia", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Asset Turnover", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Price to Book Value (PBV)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Book Value Per Share (BVPS)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "BALANCE SHEET", "Tangible Book Value Per Share", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Total Revenue", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Net Income", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Gross Profit", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Operating Expenses", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Net Interest Income (NII)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Provision for Impairment Losses (CKPN)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Earnings per Share (EPS)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Return on Assets (ROA)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Return on Equity (ROE)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Net Profit Margin (NPM)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Gross Profit Margin (GPM)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Operating Expenses to Operating Income (BOPO)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "INCOME STATEMENT", "Cost to Income Ratio (CIR)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Operating Cash Flow", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Investing Cash Flow", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Financing Cash Flow", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["20YY", "CASH FLOW STATEMENT", "Net Increase Decrease in Cash and Cash Equivalents", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${c}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Orcas_Dataset_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = async (filename: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/sync-data/files/${encodeURIComponent(filename)}/content`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const rawContent: string = data.content;
        const parsedRows = rawContent.split('\n')
            .filter(line => line.trim())
            .map(line => line.split(',').map(cell => cell.replace(/\.0+$/, ''))); 
        setViewFile({ filename: data.filename, rows: parsedRows });
      } else {
        alert("Failed to fetch file content.");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching file content.");
    }
  };

  const handleDelete = async (filename: string, skipConfirm = false) => {

    if (!skipConfirm && !window.confirm(`Are you sure you want to delete ${filename}?`)) return;

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
      fetchTrash();
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
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleDownloadTemplate} 
            className="w-fit text-sm bg-transparent hover:bg-orange-50 text-orange-600 border border-orange-500 font-semibold shadow-sm"
          >
            Download Template
          </Button>
          <div className="text-sm text-gray-500 font-medium">
            {lastRefreshed && `Dataset synchronized as of: ${lastRefreshed.toLocaleString('en-US')}`}
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-orange-50 border-b border-orange-200 p-4 flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <h3 className="font-bold text-orange-800 text-lg">Warning: Data Clone Detected</h3>
            </div>
            <div className="p-6 text-gray-700">
              <p className="font-medium">{warningMsg.replace("[WARN-01] Data Clone Detected: ", "")}</p>
              <p className="text-sm mt-4 text-gray-500">
                Please verify if the uploaded file is correct or if it was mistakenly copied from a previous year.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              {warningFile && (
                <button
                  type="button"
                  onClick={() => {
                    setWarningMsg(null);
                    handleDelete(warningFile, true);
                  }}
                  className="bg-white text-red-600 px-4 py-2 rounded font-medium border-none shadow-sm hover:bg-white focus:outline-none"
                >
                  Move to trash
                </button>
              )}
              <button
                type="button"
                onClick={() => setWarningMsg(null)}
                className="bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-action))] text-white font-medium px-4 py-2 rounded shadow-sm hover:opacity-90 focus:outline-none"
              >
                I Understand, Dismiss
              </button>
            </div>
          </div>
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
            Data Files ({files.length})
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
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "15%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[rgb(var(--color-border))]">
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Year</th>
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Filename</th>
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Size</th>
                    <th className="text-left py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Modified</th>
                    <th className="text-center py-3 px-4 font-medium text-[rgb(var(--color-text-subtle))]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.filename}
                      className="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-alt))]"
                    >
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[rgb(var(--color-primary))]">
                          {file.year ?? "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[rgb(var(--color-text))]">
                        {file.filename}
                      </td>
                      <td className="py-3 px-4 text-[rgb(var(--color-text-subtle))]">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="py-3 px-4 text-[rgb(var(--color-text-subtle))]">
                        {formatDate(file.modified_at)}
                      </td>
                      <td className="py-3 px-4 text-center space-x-4">
                        <span
                          onClick={() => handleView(file.filename)}
                          className="text-[rgb(var(--color-primary))] font-semibold cursor-pointer hover:underline"
                        >
                          View
                        </span>
                        <span
                          onClick={() => handleDelete(file.filename)}
                          className="text-red-600 font-semibold cursor-pointer hover:underline"
                        >
                          Delete
                        </span>
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
    
      {/* Trash Trigger Button */}
      <div className="mt-8 flex justify-start">
        <button
          onClick={() => { setShowTrash(true); fetchTrash(); }}
          className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))] transition-colors"
        >
          <span className="text-lg">🗑️</span>
          <span className="font-semibold">Trash</span>
          {trashFiles.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
              {trashFiles.length}
            </span>
          )}
        </button>
      </div>

      {/* Trash Modal */}
      {showTrash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--color-border))]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🗑️</span>
                <div>
                  <h2 className="text-lg font-bold text-[rgb(var(--color-text))]">Trash</h2>
                  <p className="text-xs text-[rgb(var(--color-text-subtle))]">
                    {trashFiles.length === 0 ? "Empty" : `${trashFiles.length} deleted dataset${trashFiles.length > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowTrash(false); setSelectedTrash([]); }}
                className="text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))] text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {trashFiles.length === 0 ? (
                <div className="text-center py-12 text-[rgb(var(--color-text-subtle))]">
                  <div className="text-5xl mb-4">🗑️</div>
                  <p className="font-medium">Trash is empty</p>
                  <p className="text-sm mt-1">Deleted datasets will appear here</p>
                </div>
              ) : (
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-28" />
                    <col />
                    <col className="w-24" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[rgb(var(--color-border))]">
                      <th className="py-2 px-3 text-left">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={selectedTrash.length === trashFiles.length && trashFiles.length > 0}
                          onChange={(e) =>
                            setSelectedTrash(e.target.checked ? trashFiles.map(f => f.filename) : [])
                          }
                        />
                      </th>
                      <th className="py-2 px-3 text-left font-medium text-[rgb(var(--color-text-subtle))]">Filename</th>
                      <th className="py-2 px-3 text-left font-medium text-[rgb(var(--color-text-subtle))]">Deleted At</th>
                      <th className="py-2 px-3 text-right font-medium text-[rgb(var(--color-text-subtle))]">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashFiles.map((file) => (
                      <tr
                        key={file.filename}
                        className="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface-hover))]"
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={selectedTrash.includes(file.filename)}
                            onChange={() => toggleTrashSelection(file.filename)}
                          />
                        </td>
                        <td className="py-3 px-3 font-mono text-[rgb(var(--color-text))] truncate">{file.filename}</td>
                        <td className="py-3 px-3 text-[rgb(var(--color-text-subtle))]">{formatDate(file.modified_at)}</td>
                        <td className="py-3 px-3 text-right text-[rgb(var(--color-text-subtle))]">{formatFileSize(file.size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-alt))]">
              <div className="flex gap-2">
                {selectedTrash.length > 0 && (
                  <>
                    <button
                      onClick={() => { selectedTrash.forEach(f => handleRestore(f)); setSelectedTrash([]); }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-[rgb(var(--color-primary))] text-white hover:opacity-90 transition"
                    >
                      Put Back ({selectedTrash.length})
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`⚠️ Permanently delete ${selectedTrash.length} file(s)?\n\nThis action CANNOT be undone. The data will be destroyed forever.`)) {
                          selectedTrash.forEach(f => handleDeleteTrash(f));
                          setSelectedTrash([]);
                        }
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                    >
                      Delete Permanently ({selectedTrash.length})
                    </button>
                    <button
                      onClick={() => setSelectedTrash([])}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-[rgb(var(--color-text-subtle))] hover:text-[rgb(var(--color-text))] transition"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  if (trashFiles.length === 0) return;
                  if (window.confirm(`⚠️ Empty Trash?\n\nThis will permanently delete ALL ${trashFiles.length} file(s) in Trash.\n\nThis action CANNOT be undone.`)) {
                    handleEmptyTrash();
                    setSelectedTrash([]);
                  }
                }}
                disabled={trashFiles.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Quick Look View Modal */}
      {viewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden border border-gray-300 transform transition-all">
            {/* Window Header (Green) */}
            <div className="bg-[rgb(var(--color-primary))] flex items-center justify-between px-4 py-3 shrink-0">
              {/* Left X button */}
              <button
                onClick={() => setViewFile(null)}
                className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 shadow-inner flex items-center justify-center cursor-pointer border border-red-700 focus:outline-none group"
                title="Close"
              >
                <span className="text-[10px] text-white leading-none font-bold">✕</span>
              </button>
              
              <div className="flex-1 text-center text-white font-semibold flex items-center justify-center gap-2">
                <span className="text-xl leading-none">📄</span>
                {viewFile.filename}
              </div>
              
              {/* Empty space to keep title centered */}
              <div className="w-4 h-4"></div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-auto bg-[#f8f9fa]">
              <table className="w-full border-collapse text-xs md:text-sm text-black select-text">
                <thead className="sticky top-0 bg-[#e0e0e0] z-10 shadow-sm border-b-2 border-gray-400">
                  <tr>
                    {viewFile.rows[0]?.map((header, idx) => (
                      <th key={idx} className="border-r border-gray-400 border-b border-gray-400 px-3 py-2 text-left font-bold whitespace-nowrap bg-[#ebebeb]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewFile.rows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-blue-100/50">
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="border-r border-b border-gray-300 px-3 py-1.5 whitespace-nowrap font-mono text-[13px]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

