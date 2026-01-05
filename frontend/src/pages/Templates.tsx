import { useState, useEffect } from "react";
import {
  User,
  TemplateOut,
  TemplateMetricConfig,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../services/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { useCatalog } from "../contexts/CatalogContext";

interface TemplatesProps {
  user: User;
}

export default function Templates({ user }: TemplatesProps) {
  const { catalog } = useCatalog();
  const [templates, setTemplates] = useState<TemplateOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateOut | null>(
    null
  );
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formVisibility, setFormVisibility] = useState<"private" | "public">(
    "private"
  );
  const [formMetrics, setFormMetrics] = useState<TemplateMetricConfig[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getTemplates(0, 50, false);
      setTemplates(res.templates);
    } catch (err: unknown) {
      const e = err as { detail?: string };
      setError(e.detail || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormDesc("");
    setFormVisibility("private");
    setFormMetrics([]);
    setShowModal(true);
  };

  const openEdit = (t: TemplateOut) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormDesc(t.description || "");
    setFormVisibility(t.visibility as "private" | "public");
    setFormMetrics(t.metrics_config);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert("Name is required");
      return;
    }
    if (formMetrics.length === 0) {
      alert("At least one metric is required");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          name: formName,
          description: formDesc || null,
          visibility: formVisibility,
          metrics_config: formMetrics,
        });
      } else {
        await createTemplate({
          name: formName,
          description: formDesc || null,
          visibility: formVisibility,
          metrics_config: formMetrics,
        });
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      fetchTemplates();
    } catch (err: unknown) {
      const e = err as { detail?: string };
      alert(e.detail || "Failed to delete");
    }
  };

  const addMetric = () => {
    const allMetrics = catalog?.sections.flatMap((s) => s.metrics) || [];
    if (allMetrics.length === 0) return;
    const first = allMetrics[0];
    setFormMetrics([
      ...formMetrics,
      { metric_name: first.label, type: "benefit", weight: 1 },
    ]);
  };

  const removeMetric = (idx: number) => {
    setFormMetrics(formMetrics.filter((_, i) => i !== idx));
  };

  const updateMetric = (
    idx: number,
    field: keyof TemplateMetricConfig,
    value: string | number
  ) => {
    const updated = [...formMetrics];
    if (field === "weight") {
      updated[idx] = { ...updated[idx], weight: Number(value) };
    } else if (field === "type") {
      updated[idx] = { ...updated[idx], type: value as "benefit" | "cost" };
    } else {
      updated[idx] = { ...updated[idx], metric_name: value as string };
    }
    setFormMetrics(updated);
  };

  const allMetricOptions = catalog?.sections.flatMap((s) => s.metrics) || [];

  return (
    <div className="space-y-4">
      <Card
        header={
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Scoring Templates</span>
            <Button onClick={openCreate} size="sm">
              + New Template
            </Button>
          </div>
        }
      >
        {loading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && templates.length === 0 && (
          <p className="text-gray-500">No templates yet. Create one!</p>
        )}
        {!loading && templates.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Visibility</th>
                <th>Metrics</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        t.visibility === "public"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {t.visibility}
                    </span>
                  </td>
                  <td>{t.metrics_config.length} metrics</td>
                  <td>
                    {t.user_id === user.id ? "You" : `User #${t.user_id}`}
                  </td>
                  <td className="space-x-2">
                    {t.user_id === user.id && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(t)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(t.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {showModal && (
        <Modal
          title={editingTemplate ? "Edit Template" : "Create Template"}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                className="w-full border rounded px-3 py-2"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Visibility
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                value={formVisibility}
                onChange={(e) =>
                  setFormVisibility(e.target.value as "private" | "public")
                }
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Metrics</label>
                <Button size="sm" onClick={addMetric}>
                  + Add Metric
                </Button>
              </div>
              {formMetrics.length === 0 && (
                <p className="text-gray-500 text-sm">No metrics added yet</p>
              )}
              {formMetrics.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-center mb-2">
                  <select
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    value={m.metric_name}
                    onChange={(e) =>
                      updateMetric(idx, "metric_name", e.target.value)
                    }
                  >
                    {allMetricOptions.map((opt) => (
                      <option key={opt.key} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-24 border rounded px-2 py-1 text-sm"
                    value={m.type}
                    onChange={(e) => updateMetric(idx, "type", e.target.value)}
                  >
                    <option value="benefit">Benefit</option>
                    <option value="cost">Cost</option>
                  </select>
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1 text-sm"
                    value={m.weight}
                    onChange={(e) =>
                      updateMetric(idx, "weight", e.target.value)
                    }
                    min={0.1}
                    step={0.1}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => removeMetric(idx)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
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
