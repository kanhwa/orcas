import { useState, useEffect } from "react";
import {
  User,
  ScoringRunSummary,
  getScoringRuns,
  getScoringRunDetail,
  deleteScoringRun,
  getExportScoringRunUrl,
  getExportAllScoringRunsUrl,
} from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { useCatalog } from "../contexts/CatalogContext";

interface ReportsProps {
  user: User;
}

export default function Reports({ user: _user }: ReportsProps) {
  void _user;
  const { getYearOptions } = useCatalog();
  const years = getYearOptions();

  const [runs, setRuns] = useState<ScoringRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [yearFilter, setYearFilter] = useState<number | "">("");

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    id: number;
    year: number;
    created_at: string;
    items: { rank: number; ticker: string; score: number }[];
  } | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getScoringRuns(0, 50, yearFilter || undefined);
      setRuns(res.runs);
      setTotal(res.total);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Failed to load scoring runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [yearFilter]);

  const openDetail = async (runId: number) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const detail = await getScoringRunDetail(runId);
      setDetailData({
        id: detail.id,
        year: detail.year,
        created_at: detail.created_at,
        items: detail.items.map((i) => ({
          rank: i.rank,
          ticker: i.ticker,
          score: i.score,
        })),
      });
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to load detail");
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this scoring run?")) return;
    try {
      await deleteScoringRun(id);
      fetchRuns();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to delete");
    }
  };

  const downloadExport = (runId: number, format: "csv" | "json" | "pdf") => {
    window.open(getExportScoringRunUrl(runId, format), "_blank");
  };

  const downloadAllExport = (format: "csv" | "json") => {
    window.open(
      getExportAllScoringRunsUrl(format, yearFilter || undefined),
      "_blank"
    );
  };

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-lg font-semibold">
              Scoring History & Reports
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={yearFilter}
                onChange={(e) =>
                  setYearFilter(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                className="w-32"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadAllExport("csv")}
              >
                Export All CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadAllExport("json")}
              >
                Export All JSON
              </Button>
            </div>
          </div>
        }
      >
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && runs.length === 0 && (
          <p className="text-gray-500">
            No scoring runs yet. Run a scoring from Dashboard!
          </p>
        )}
        {!loading && runs.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-2">Total: {total} runs</p>
            <Table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Year</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>{r.year}</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td className="space-x-1">
                      <Button size="sm" onClick={() => openDetail(r.id)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => downloadExport(r.id, "csv")}
                      >
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => downloadExport(r.id, "json")}
                      >
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => downloadExport(r.id, "pdf")}
                      >
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(r.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card>

      {showDetail && (
        <Modal
          title={`Scoring Run #${detailData?.id || "..."}`}
          onClose={() => setShowDetail(false)}
        >
          {detailLoading && <p className="text-gray-500">Loading...</p>}
          {detailData && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span>
                  <strong>Year:</strong> {detailData.year}
                </span>
                <span>
                  <strong>Created:</strong>{" "}
                  {new Date(detailData.created_at).toLocaleString()}
                </span>
              </div>
              <Table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Ticker</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.items.map((item) => (
                    <tr key={item.rank}>
                      <td>{item.rank}</td>
                      <td className="font-mono">{item.ticker}</td>
                      <td>{item.score.toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
