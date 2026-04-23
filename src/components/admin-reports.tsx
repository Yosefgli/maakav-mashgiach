"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Edit2, Trash2, X } from "lucide-react";
import { deleteVisitLog, updateVisitLog } from "@/lib/data-service";
import type { VisitLog, VisitStatus } from "@/lib/types";
import { formatDateTime, getStatusTone } from "@/lib/utils";

const STATUS_LABELS: Record<VisitLog["status"], string> = {
  success: "הצלחה",
  unauthorized: "לא מורשה",
  invalid_location: "מקום לא תקין",
  error: "שגיאה",
};

const ALL_STATUSES: VisitStatus[] = ["success", "unauthorized", "invalid_location", "error"];

export function AdminReports({
  logs,
  onDeleted,
  onUpdated,
}: {
  logs: VisitLog[];
  onDeleted: (id: string) => void;
  onUpdated: (id: string, data: { status: VisitStatus; message: string }) => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<VisitLog | null>(null);
  const [editTarget, setEditTarget] = useState<VisitLog | null>(null);
  const [editForm, setEditForm] = useState<{ status: VisitStatus; message: string }>({ status: "success", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (log: VisitLog) => {
    setBusy(true);
    setError(null);
    try {
      await deleteVisitLog(log.id);
      onDeleted(log.id);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "מחיקה נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (log: VisitLog) => {
    setEditForm({ status: log.status, message: log.message });
    setEditTarget(log);
    setError(null);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setBusy(true);
    setError(null);
    try {
      await updateVisitLog(editTarget.id, editForm);
      onUpdated(editTarget.id, editForm);
      setEditTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "עדכון נכשל.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adminSection">
      {error && <div className="message message--danger"><AlertCircle size={16} />{error}</div>}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>תאריך ושעה</th>
              <th>משגיח</th>
              <th>מקום</th>
              <th>עיר</th>
              <th>סטטוס</th>
              <th>הודעה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={7} className="emptyRow">לא נמצאו לוגים.</td></tr>
            )}
            {logs.map((log) => {
              const tone = getStatusTone(log.status);
              return (
                <tr key={log.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(log.occurredAt)}</td>
                  <td>{log.mashgiachName}</td>
                  <td>{log.locationName ?? "לא זוהה"}</td>
                  <td>{log.city ?? "-"}</td>
                  <td>
                    <span className={`badge badge--${tone}`}>{STATUS_LABELS[log.status]}</span>
                  </td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.message}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button
                        className="button button--icon button--ghost"
                        onClick={() => openEdit(log)}
                        title="עריכה"
                        type="button"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="button button--icon button--ghost"
                        onClick={() => { setError(null); setDeleteConfirm(log); }}
                        title="מחק דיווח"
                        type="button"
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className="modalBackdrop" onClick={() => setEditTarget(null)} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>עריכת דיווח</h2>
              <button className="button button--icon button--ghost" onClick={() => setEditTarget(null)} type="button"><X size={18} /></button>
            </div>

            {error && <div className="message message--danger"><AlertCircle size={16} />{error}</div>}

            <div className="form">
              <label className="field">
                <span>סטטוס</span>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as VisitStatus })}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>הודעה</span>
                <textarea
                  value={editForm.message}
                  onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, font: "inherit", resize: "vertical" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="button button--ghost" onClick={() => setEditTarget(null)} type="button">ביטול</button>
              <button
                className="button button--primary"
                onClick={() => void handleEdit()}
                disabled={busy || !editForm.message.trim()}
                type="button"
              >
                {busy ? "שומר..." : "שמור"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modalBackdrop" onClick={() => setDeleteConfirm(null)} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>מחיקת דיווח</h2>
              <button className="button button--icon button--ghost" onClick={() => setDeleteConfirm(null)} type="button"><X size={18} /></button>
            </div>

            <div className="scanResult">
              <div className="scanResult__icon scanResult__icon--danger">
                <AlertCircle size={28} />
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", textAlign: "center" }}>
                מחיקת הדיווח של <strong>{deleteConfirm.mashgiachName}</strong> מ-{formatDateTime(deleteConfirm.occurredAt)}.
                פעולה זו בלתי הפיכה.
              </p>
            </div>

            {error && <div className="message message--danger"><AlertCircle size={16} />{error}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="button button--ghost button--wide" onClick={() => setDeleteConfirm(null)} type="button">ביטול</button>
              <button
                className="button button--primary button--wide"
                onClick={() => void handleDelete(deleteConfirm)}
                disabled={busy}
                type="button"
                style={{ background: "var(--danger)" }}
              >
                {busy ? "מוחק..." : "מחק"}
              </button>
            </div>
          </section>
        </div>
      )}

      {logs.length === 0 && (
        <div className="adminSection__empty" style={{ color: "var(--success)" }}>
          <CheckCircle2 size={16} />
          <span>הלוג ריק</span>
        </div>
      )}
    </div>
  );
}
