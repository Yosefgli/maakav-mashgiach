"use client";

import { useEffect, useState } from "react";
import { Edit2, MapPin, Plus, QrCode, Trash2, X } from "lucide-react";
import {
  createLocation,
  deleteLocation,
  fetchLocations,
  updateLocation,
} from "@/lib/data-service";
import type { Location } from "@/lib/types";

function generateQrCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `LOC-${rand(4)}-${rand(4)}`;
}

type FormState = { name: string; city: string; qrCode: string };
const EMPTY_FORM: FormState = { name: "", city: "", qrCode: "" };

export function AdminLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "qr" | null>(null);
  const [selected, setSelected] = useState<Location | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Location | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setLocations(await fetchLocations());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת מקומות.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, qrCode: generateQrCode() });
    setSelected(null);
    setModalMode("add");
  };

  const openEdit = (loc: Location) => {
    setForm({ name: loc.name, city: loc.city, qrCode: loc.qrCode });
    setSelected(loc);
    setModalMode("edit");
  };

  const closeModal = () => { setModalMode(null); setSelected(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.city.trim() || !form.qrCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (modalMode === "add") {
        await createLocation({ name: form.name.trim(), city: form.city.trim(), qrCode: form.qrCode.trim() });
      } else if (modalMode === "edit" && selected) {
        await updateLocation(selected.id, { name: form.name.trim(), city: form.city.trim() });
      }
      await load();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (loc: Location) => {
    setBusy(true);
    try {
      await updateLocation(loc.id, { isActive: !loc.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (loc: Location) => {
    setBusy(true);
    setError(null);
    try {
      await deleteLocation(loc.id);
      await load();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה במחיקה.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adminSection">
      {error && <div className="message message--danger">{error}</div>}

      <div className="adminSection__toolbar">
        <button className="button button--primary" onClick={openAdd} type="button">
          <Plus size={15} /> מקום חדש
        </button>
      </div>

      {loading ? (
        <div className="adminSection__empty">טוען...</div>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>שם המקום</th>
                <th>עיר</th>
                <th>קוד QR</th>
                <th>סטטוס</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 && (
                <tr><td colSpan={5} className="emptyRow">אין מקומות עדיין.</td></tr>
              )}
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td>
                    <div className="adminSection__locName">
                      <MapPin size={14} style={{ color: "var(--primary)" }} />
                      {loc.name}
                    </div>
                  </td>
                  <td>{loc.city}</td>
                  <td>
                    <code className="qrCodeText">{loc.qrCode}</code>
                  </td>
                  <td>
                    <button
                      className={`badge ${loc.isActive ? "badge--success" : "badge--danger"}`}
                      onClick={() => void handleToggleActive(loc)}
                      disabled={busy}
                      type="button"
                      style={{ cursor: "pointer" }}
                    >
                      {loc.isActive ? "פעיל" : "לא פעיל"}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        className="button button--icon button--ghost"
                        onClick={() => { setSelected(loc); setModalMode("qr"); }}
                        title="הצג QR"
                        type="button"
                      >
                        <QrCode size={15} />
                      </button>
                      <button
                        className="button button--icon button--ghost"
                        onClick={() => openEdit(loc)}
                        title="עריכה"
                        type="button"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="button button--icon button--ghost"
                        onClick={() => setDeleteConfirm(loc)}
                        title="מחיקה"
                        type="button"
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {(modalMode === "add" || modalMode === "edit") && (
        <div className="modalBackdrop" onClick={closeModal} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>{modalMode === "add" ? "הוספת מקום" : "עריכת מקום"}</h2>
              <button className="button button--icon button--ghost" onClick={closeModal} type="button"><X size={18} /></button>
            </div>

            {error && <div className="message message--danger">{error}</div>}

            <div className="form">
              <label className="field">
                <span>שם המקום</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="מאפיית הצפון" />
              </label>
              <label className="field">
                <span>עיר</span>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="חיפה" />
              </label>
              <label className="field">
                <span>קוד QR</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input dir="ltr" value={form.qrCode} onChange={(e) => setForm({ ...form, qrCode: e.target.value })} placeholder="LOC-XXXX-XXXX" readOnly={modalMode === "edit"} style={{ flex: 1 }} />
                  {modalMode === "add" && (
                    <button className="button button--ghost" onClick={() => setForm({ ...form, qrCode: generateQrCode() })} type="button" style={{ flexShrink: 0 }}>
                      חדש
                    </button>
                  )}
                </div>
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="button button--ghost" onClick={closeModal} type="button">ביטול</button>
              <button
                className="button button--primary"
                onClick={() => void handleSave()}
                disabled={busy || !form.name.trim() || !form.city.trim() || !form.qrCode.trim()}
                type="button"
              >
                {busy ? "שומר..." : "שמור"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* QR display modal */}
      {modalMode === "qr" && selected && (
        <div className="modalBackdrop" onClick={closeModal} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>קוד QR — {selected.name}</h2>
              <button className="button button--icon button--ghost" onClick={closeModal} type="button"><X size={18} /></button>
            </div>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div className="qrBig"><code>{selected.qrCode}</code></div>
              <p style={{ color: "var(--muted)", fontSize: "0.825rem", marginTop: 8 }}>
                {selected.name} · {selected.city}
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modalBackdrop" onClick={() => setDeleteConfirm(null)} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>מחיקת מקום</h2>
              <button className="button button--icon button--ghost" onClick={() => setDeleteConfirm(null)} type="button"><X size={18} /></button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
              האם למחוק את <strong>{deleteConfirm.name}</strong>? פעולה זו בלתי הפיכה.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="button button--ghost" onClick={() => setDeleteConfirm(null)} type="button">ביטול</button>
              <button
                className="button button--primary"
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
    </div>
  );
}
