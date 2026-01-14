import { useCallback, useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import {
  combineReports,
  createReport,
  deleteReport,
  listReports,
  renameReport,
  ReportListItem,
  REPORT_TYPE_LABELS,
  REPORT_TYPES_ORDERED,
  ReportTypeId,
  BASE_URL,
  User,
  fetchReportPdfBuffer,
} from "../services/api";
import { consumeDraftReport } from "../utils/draftReport";
import { toErrorMessage } from "../utils/errors";

interface ReportsProps {
  user: User;
}

type ReportTypeFilter = "" | ReportTypeId;

const REPORT_TYPE_OPTIONS: { value: ReportTypeFilter; label: string }[] = [
  { value: "", label: "All Types" },
  ...REPORT_TYPES_ORDERED.map(({ value, label }) => ({ value, label })),
];

const formatType = (type: string) =>
  REPORT_TYPE_LABELS[type as ReportTypeId] || type || "Unknown";

const formatDate = (iso: string) => new Date(iso).toLocaleString();

export default function Reports({ user: _user }: ReportsProps) {
  void _user;

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState("");

  const [renameTarget, setRenameTarget] = useState<ReportListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [combineOpen, setCombineOpen] = useState(false);
  const [combineName, setCombineName] = useState("");
  const [combineError, setCombineError] = useState("");
  const [combineLoading, setCombineLoading] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewReport, setViewReport] = useState<ReportListItem | null>(null);
  const [viewError, setViewError] = useState("");
  const [viewLoading, setViewLoading] = useState(false);
  const [viewBlobUrl, setViewBlobUrl] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<ReportTypeId | "">("");
  const [createName, setCreateName] = useState("");
  const [createPdf, setCreatePdf] = useState<string | null>(null);
  const [createMetadata, setCreateMetadata] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [createError, setCreateError] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    setActionMessage("");
    try {
      const res = await listReports({
        q: search.trim() || undefined,
        type: typeFilter || undefined,
        skip: 0,
        limit: 200,
      });
      setReports(res.items);
      setTotal(res.total);
      setSelectedIds((prev) =>
        prev.filter((id) => res.items.some((r) => r.id === id))
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReports();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadReports]);

  useEffect(() => {
    setSelectedIds([]);
  }, [search, typeFilter]);

  useEffect(() => {
    const draftState = consumeDraftReport();
    if (draftState && typeof draftState.type === "string") {
      setCreateType(draftState.type as ReportTypeId);
      setCreatePdf(draftState.pdfBase64);
      setCreateMetadata(
        (draftState.metadata as Record<string, unknown> | null) ?? null
      );
      setCreateName(draftState.nameSuggestion || "");
      setCreateError("");
      setCreateOpen(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (viewBlobUrl) {
        URL.revokeObjectURL(viewBlobUrl);
      }
    };
  }, [viewBlobUrl]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allIds = reports.map((r) => r.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : allIds);
  };

  const enterSelectMode = () => {
    setIsSelectMode(true);
    setSelectedIds([]);
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateError("");
    setCreateName("");
    setCreatePdf(null);
    setCreateMetadata(null);
    setCreateType("");
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateError("Report name is required");
      return;
    }
    if (!createType || !createPdf) {
      setCreateError("Draft data is missing. Please try saving again.");
      return;
    }
    setCreateSaving(true);
    setCreateError("");
    try {
      await createReport({
        name,
        type: createType,
        pdf_base64: createPdf,
        metadata: createMetadata ?? null,
      });
      setActionMessage("Report created.");
      closeCreate();
      void loadReports();
    } catch (err) {
      setCreateError(toErrorMessage(err));
    } finally {
      setCreateSaving(false);
    }
  };

  const openRename = (report: ReportListItem) => {
    setRenameTarget(report);
    setRenameValue(report.name);
    setRenameError("");
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError("Name is required");
      return;
    }
    try {
      await renameReport(renameTarget.id, name);
      setRenameTarget(null);
      setActionMessage("Report renamed.");
      void loadReports();
    } catch (err) {
      setRenameError(toErrorMessage(err));
    }
  };

  const openBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteError("");
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    setDeleteError("");
    setDeleteLoading(true);
    try {
      for (const id of selectedIds) {
        await deleteReport(id);
      }
      setActionMessage(
        `Deleted ${selectedIds.length} report${
          selectedIds.length === 1 ? "" : "s"
        }.`
      );
      setSelectedIds([]);
      setIsSelectMode(false);
      setBulkDeleteOpen(false);
      void loadReports();
    } catch (err) {
      setDeleteError(toErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCombine = () => {
    setCombineOpen(true);
    setCombineName("");
    setCombineError("");
  };

  const submitCombine = async () => {
    if (selectedIds.length < 2) {
      setCombineError("Select at least two reports to combine.");
      return;
    }
    const name = combineName.trim();
    if (!name) {
      setCombineError("Name is required");
      return;
    }
    setCombineLoading(true);
    setCombineError("");
    try {
      await combineReports(name, selectedIds);
      setCombineOpen(false);
      setSelectedIds([]);
      setIsSelectMode(false);
      setCombineName("");
      setActionMessage("Reports combined.");
      void loadReports();
    } catch (err) {
      setCombineError(toErrorMessage(err));
    } finally {
      setCombineLoading(false);
    }
  };

  const handleDownload = (report: ReportListItem) => {
    const url = `${BASE_URL}/api/reports/${report.id}/pdf`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.click();
  };

  const handleView = async (report: ReportListItem) => {
    if (viewBlobUrl) {
      URL.revokeObjectURL(viewBlobUrl);
      setViewBlobUrl(null);
    }
    setViewReport(report);
    setViewOpen(true);
    setViewLoading(true);
    setViewError("");
    try {
      const buffer = await fetchReportPdfBuffer(report.id, true);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setViewBlobUrl(url);
    } catch (err) {
      setViewError(toErrorMessage(err));
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    if (viewBlobUrl) {
      URL.revokeObjectURL(viewBlobUrl);
    }
    setViewBlobUrl(null);
    setViewReport(null);
    setViewOpen(false);
    setViewError("");
  };

  const selectedReports = selectedIds
    .map((id) => reports.find((r) => r.id === id))
    .filter(Boolean) as ReportListItem[];

  const allSelected =
    reports.length > 0 && reports.every((r) => selectedIds.includes(r.id));

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports by name"
                className="border rounded px-2 py-1 text-sm"
              />
              <Select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as ReportTypeFilter)
                }
                className="w-48"
              >
                {REPORT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {isSelectMode ? (
                <>
                  <label className="flex items-center gap-1 text-sm text-[rgb(var(--color-text-subtle))]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                    <span>Select all</span>
                  </label>
                  <span className="text-xs text-[rgb(var(--color-text-subtle))]">
                    Selected: {selectedIds.length}
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={selectedIds.length < 2}
                    onClick={openCombine}
                  >
                    Combine
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={selectedIds.length === 0}
                    onClick={openBulkDelete}
                  >
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exitSelectMode}>
                    Done
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" onClick={enterSelectMode}>
                  Select
                </Button>
              )}
            </div>
          </div>
        }
      >
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && reports.length === 0 && (
          <p className="text-gray-500">No reports found.</p>
        )}
        {!loading && !error && reports.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-2">Total: {total} reports</p>
            {actionMessage && (
              <p className="text-sm text-green-700 mb-2">{actionMessage}</p>
            )}
            <Table>
              <thead>
                <tr>
                  {isSelectMode && <th style={{ width: 32 }}></th>}
                  <th>Name</th>
                  <th>Type</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const isSelected = selectedIds.includes(report.id);
                  return (
                    <tr
                      key={report.id}
                      className={isSelectMode ? "cursor-pointer" : undefined}
                      onClick={
                        isSelectMode
                          ? () => toggleSelection(report.id)
                          : undefined
                      }
                    >
                      {isSelectMode && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(report.id)}
                          />
                        </td>
                      )}
                      <td>{report.name}</td>
                      <td>{formatType(report.type)}</td>
                      <td>{formatDate(report.created_at)}</td>
                      <td
                        className="space-x-1 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="report"
                          onClick={() => handleDownload(report)}
                        >
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="report"
                          onClick={() => openRename(report)}
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleView(report);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </Card>

      {createOpen && (
        <Modal title="Create Report" onClose={closeCreate}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <p className="mt-1 text-sm text-gray-800">
                {createType
                  ? REPORT_TYPE_LABELS[createType as ReportTypeId]
                  : "Unknown"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Report name
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Enter report name"
              />
            </div>
            {createError && (
              <p className="text-red-500 text-sm">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeCreate}>
                Cancel
              </Button>
              <Button
                onClick={submitCreate}
                disabled={
                  !createName.trim() ||
                  !createPdf ||
                  !createType ||
                  createSaving
                }
              >
                {createSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal
          title={`Rename Report: ${renameTarget.name}`}
          onClose={() => setRenameTarget(null)}
        >
          <div className="space-y-3">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="New report name"
            />
            {renameError && (
              <p className="text-red-500 text-sm">{renameError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button onClick={submitRename}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {bulkDeleteOpen && (
        <Modal
          title={`Delete ${selectedIds.length} selected report${
            selectedIds.length === 1 ? "" : "s"
          }?`}
          onClose={() => setBulkDeleteOpen(false)}
        >
          <div className="space-y-3">
            <p>
              Delete {selectedIds.length} selected report
              {selectedIds.length === 1 ? "" : "s"}? This cannot be undone.
            </p>
            {deleteError && (
              <p className="text-red-500 text-sm">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setBulkDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmBulkDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {viewOpen && viewReport && (
        <Modal
          title={`View Report: ${viewReport.name}`}
          onClose={closeView}
          hideCloseButton
          footer={
            <div className="flex justify-end">
              <Button onClick={closeView}>Close</Button>
            </div>
          }
        >
          <div className="space-y-3">
            {viewLoading && (
              <p className="text-sm text-gray-600">Loading preview...</p>
            )}
            {viewError && (
              <p className="text-red-500 text-sm">
                Preview failed. Please use the PDF button to download.
              </p>
            )}
            <div className="border rounded overflow-hidden h-[70vh]">
              {viewBlobUrl && !viewError ? (
                <iframe
                  key={viewReport.id}
                  src={viewBlobUrl}
                  title={`Report ${viewReport.name}`}
                  className="w-full h-full"
                  style={{ border: 0 }}
                  onLoad={() => setViewLoading(false)}
                  onError={() => {
                    setViewLoading(false);
                    setViewError("Failed to load preview.");
                  }}
                />
              ) : null}
            </div>
          </div>
        </Modal>
      )}

      {combineOpen && (
        <Modal title="Combine Reports" onClose={() => setCombineOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm text-[rgb(var(--color-text-subtle))]">
              Combine preserves the selection order and deletes the originals
              after the new report is created.
            </p>
            <input
              type="text"
              value={combineName}
              onChange={(e) => setCombineName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Combined report name"
            />
            <div className="border rounded px-3 py-2 max-h-48 overflow-auto text-sm">
              <p className="font-semibold mb-2">
                {selectedIds.length} selected
              </p>
              {selectedReports.length === 0 && (
                <p className="text-gray-500">Nothing selected.</p>
              )}
              {selectedReports.map((r, idx) => (
                <p key={r.id}>
                  {idx + 1}. {r.name} ({formatType(r.type)})
                </p>
              ))}
            </div>
            {combineError && (
              <p className="text-red-500 text-sm">{combineError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCombineOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitCombine}
                disabled={combineLoading || selectedIds.length < 2}
              >
                {combineLoading ? "Combining..." : "Combine"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
