"use client";

import { useEffect, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import {
  createUser,
  deleteUser,
  fetchLocations,
  fetchUsers,
  setLocationAssignment,
} from "@/lib/data-service";
import type { Location, Role, UserRecord } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = { mashgiach: "משגיח", admin: "מנהל" };

type AddForm = { email: string; fullName: string; password: string; role: Role };
const EMPTY_FORM: AddForm = { email: "", fullName: "", password: "", role: "mashgiach" };

export function AdminMashgichim() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [assignModal, setAssignModal] = useState<UserRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRecord | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([fetchUsers(), fetchLocations()]);
      setUsers(u);
      setLocations(l);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleAdd = async () => {
    if (!form.email.trim() || !form.fullName.trim() || !form.password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createUser({ ...form, email: form.email.trim(), fullName: form.fullName.trim() });
      await load();
      setAddModal(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "יצירת משתמש נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (user: UserRecord) => {
    setBusy(true);
    setError(null);
    try {
      await deleteUser(user.userId);
      await load();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "מחיקה נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAssignment = async (user: UserRecord, locationId: string, assign: boolean) => {
    const key = `${user.userId}-${locationId}`;
    setPendingAssignments((prev) => new Set(prev).add(key));
    try {
      await setLocationAssignment(user.userId, locationId, assign);
      setUsers((prev) =>
        prev.map((u) =>
          u.userId !== user.userId ? u : {
            ...u,
            assignedLocationIds: assign
              ? [...new Set([...u.assignedLocationIds, locationId])]
              : u.assignedLocationIds.filter((id) => id !== locationId),
          }
        )
      );
      if (assignModal?.userId === user.userId) {
        setAssignModal((prev) =>
          prev ? {
            ...prev,
            assignedLocationIds: assign
              ? [...new Set([...prev.assignedLocationIds, locationId])]
              : prev.assignedLocationIds.filter((id) => id !== locationId),
          } : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשיוך.");
    } finally {
      setPendingAssignments((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  return (
    <div className="adminSection">
      {error && <div className="message message--danger">{error}</div>}

      <div className="adminSection__toolbar">
        <button className="button button--primary" onClick={() => { setForm(EMPTY_FORM); setAddModal(true); }} type="button">
          <Plus size={15} /> משתמש חדש
        </button>
      </div>

      {loading ? (
        <div className="adminSection__empty">טוען...</div>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>תפקיד</th>
                <th>מקומות משויכים</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} className="emptyRow">אין משתמשים.</td></tr>
              )}
              {users.map((user) => (
                <tr key={user.userId}>
                  <td>{user.fullName}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === "admin" ? "badge--warning" : "badge--success"}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td>
                    {user.role === "mashgiach" ? (
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                        {user.assignedLocationIds.length} מקומות
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {user.role === "mashgiach" && (
                        <button
                          className="button button--icon button--ghost"
                          onClick={() => setAssignModal(user)}
                          title="שיוך מקומות"
                          type="button"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      <button
                        className="button button--icon button--ghost"
                        onClick={() => setDeleteConfirm(user)}
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

      {/* Add user modal */}
      {addModal && (
        <div className="modalBackdrop" onClick={() => setAddModal(false)} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>משתמש חדש</h2>
              <button className="button button--icon button--ghost" onClick={() => setAddModal(false)} type="button"><X size={18} /></button>
            </div>

            {error && <div className="message message--danger">{error}</div>}

            <div className="form">
              <label className="field">
                <span>שם מלא</span>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="ישראל ישראלי" />
              </label>
              <label className="field">
                <span>אימייל</span>
                <input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
              </label>
              <label className="field">
                <span>סיסמה ראשונית</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="לפחות 6 תווים" />
              </label>
              <label className="field">
                <span>תפקיד</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  <option value="mashgiach">משגיח</option>
                  <option value="admin">מנהל</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="button button--ghost" onClick={() => setAddModal(false)} type="button">ביטול</button>
              <button
                className="button button--primary"
                onClick={() => void handleAdd()}
                disabled={busy || !form.email.trim() || !form.fullName.trim() || !form.password.trim()}
                type="button"
              >
                {busy ? "יוצר..." : "צור משתמש"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Assignments modal */}
      {assignModal && (
        <div className="modalBackdrop" onClick={() => setAssignModal(null)} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>מקומות — {assignModal.fullName}</h2>
              <button className="button button--icon button--ghost" onClick={() => setAssignModal(null)} type="button"><X size={18} /></button>
            </div>
            <div className="assignList">
              {locations.map((loc) => {
                const checked = assignModal.assignedLocationIds.includes(loc.id);
                const key = `${assignModal.userId}-${loc.id}`;
                return (
                  <label key={loc.id} className="assignItem">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pendingAssignments.has(key)}
                      onChange={() => void handleToggleAssignment(assignModal, loc.id, !checked)}
                    />
                    <span>{loc.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{loc.city}</span>
                    {!loc.isActive && <span className="badge badge--danger" style={{ fontSize: "0.7rem" }}>לא פעיל</span>}
                  </label>
                );
              })}
              {locations.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>אין מקומות במערכת.</p>
              )}
            </div>
            <button className="button button--primary button--wide" onClick={() => setAssignModal(null)} type="button">סגור</button>
          </section>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modalBackdrop" onClick={() => setDeleteConfirm(null)} role="presentation">
          <section className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal__topBar">
              <h2>מחיקת משתמש</h2>
              <button className="button button--icon button--ghost" onClick={() => setDeleteConfirm(null)} type="button"><X size={18} /></button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
              האם למחוק את <strong>{deleteConfirm.fullName}</strong>? הפעולה בלתי הפיכה.
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
