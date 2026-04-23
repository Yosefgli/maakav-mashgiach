"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  LogOut,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  fetchAdminDashboard,
  fetchMashgiachDashboard,
  getCurrentSessionProfile,
  isSupabaseConfigured,
  signInWithEmail,
  signOutCurrentUser,
  submitVisitScan,
  type DashboardFilters,
} from "@/lib/data-service";
import type {
  AdminDashboardData,
  LoginFormState,
  MashgiachDashboardData,
  Profile,
  Role,
  ScanResult,
  VisitStatus,
} from "@/lib/types";
import { formatDateTime, formatRelativeTime, getStatusTone } from "@/lib/utils";
import { QrScannerDialog } from "./qr-scanner-dialog";
import { AdminLocations } from "./admin-locations";
import { AdminMashgichim } from "./admin-mashgichim";
import { AdminReports } from "./admin-reports";

const REFRESH_INTERVAL_MS = 60_000;
const EMPTY_LOGIN: LoginFormState = { email: "", password: "" };
const EMPTY_FILTERS: DashboardFilters = { from: "", to: "", mashgiachName: "", locationName: "", city: "" };

type AdminView = "dashboard" | "locations" | "mashgichim" | "reports";

const ADMIN_TABS: { id: AdminView; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "דשבורד", icon: <CalendarDays size={15} /> },
  { id: "locations", label: "מקומות", icon: <MapPin size={15} /> },
  { id: "mashgichim", label: "משגיחים", icon: <Users size={15} /> },
  { id: "reports", label: "דיווחים", icon: <FileText size={15} /> },
];

export function AppShell() {
  const [loginForm, setLoginForm] = useState<LoginFormState>(EMPTY_LOGIN);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [mashgiachData, setMashgiachData] = useState<MashgiachDashboardData | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanResult | null>(null);
  const [adminView, setAdminView] = useState<AdminView>("dashboard");

  const configured = isSupabaseConfigured();

  const loadDashboard = useCallback(
    async (p: Profile, f: DashboardFilters, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        if (p.role === "mashgiach") {
          setMashgiachData(await fetchMashgiachDashboard(p, f));
          setAdminData(null);
        } else {
          setAdminData(await fetchAdminDashboard(p, f));
          setMashgiachData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה תקלה בטעינת הנתונים.");
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setLoadingProfile(true);
      try {
        const p = await getCurrentSessionProfile();
        if (!active) return;
        setProfile(p);
        setError(null);
        if (p) await loadDashboard(p, EMPTY_FILTERS);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "לא הצלחנו לזהות משתמש מחובר.");
      } finally {
        if (active) setLoadingProfile(false);
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, [loadDashboard]);

  useEffect(() => {
    if (!profile) return;
    const interval = window.setInterval(() => void loadDashboard(profile, filters, true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [filters, loadDashboard, profile]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await signInWithEmail(loginForm.email, loginForm.password);
      setProfile(p);
      setFilters(EMPTY_FILTERS);
      await loadDashboard(p, EMPTY_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההתחברות נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOutCurrentUser();
      setProfile(null);
      setMashgiachData(null);
      setAdminData(null);
      setScanFeedback(null);
      setLoginForm(EMPTY_LOGIN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו להתנתק.");
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async (role: Role) => {
    setBusy(true);
    setError(null);
    try {
      const p = await getCurrentSessionProfile(role);
      if (!p) throw new Error("לא נמצא משתמש דמו.");
      setProfile(p);
      setFilters(EMPTY_FILTERS);
      await loadDashboard(p, EMPTY_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "כניסת הדמו נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = () => { if (profile) void loadDashboard(profile, filters); };

  const onScan = async (qrCode: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const result = await submitVisitScan(profile, qrCode);
      setScanFeedback(result);
      await loadDashboard(profile, filters, true);
    } catch (err) {
      setScanFeedback({ status: "error", message: err instanceof Error ? err.message : "הסריקה נכשלה." });
    } finally {
      setBusy(false);
    }
  };

  // Dropdown options derived from existing logs (no extra fetch needed)
  const filterOptions = useMemo(() => {
    const logs = adminData?.logs ?? [];
    return {
      mashgichim: [...new Set(logs.map((l) => l.mashgiachName))].sort(),
      locations: [...new Set(logs.map((l) => l.locationName).filter(Boolean) as string[])].sort(),
      cities: [...new Set(logs.map((l) => l.city).filter(Boolean) as string[])].sort(),
    };
  }, [adminData]);

  const pageTitle = useMemo(() => {
    if (!profile) return "מעקב ביקורי משגיחים";
    return profile.role === "admin" ? "דשבורד מנהל" : "דשבורד משגיח";
  }, [profile]);

  if (loadingProfile) {
    return (
      <div className="app">
        <div className="loadingState">
          <RefreshCw size={20} className="spin" />
          <span>טוען...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app">
        <LoginPanel
          busy={busy}
          configured={configured}
          error={error}
          form={loginForm}
          onChange={setLoginForm}
          onDemoLogin={handleDemoLogin}
          onSubmit={handleLogin}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* Sticky header */}
      <header className="appHeader">
        <div className="appHeader__brand">
          <ShieldCheck size={18} className="appHeader__icon" />
          <div className="appHeader__title">{pageTitle}</div>
        </div>

        <div className="appHeader__user">
          <strong>{profile.fullName}</strong>
          <span>{profile.role === "admin" ? "מנהל" : "משגיח"}</span>
        </div>

        <div className="appHeader__actions">
          <button
            className="button button--icon button--ghost"
            disabled={refreshing || busy}
            onClick={onRefresh}
            type="button"
            aria-label="רענון"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          </button>
          {profile.role === "mashgiach" && (
            <button
              className="button button--primary headerScanBtn"
              onClick={() => setScannerOpen(true)}
              type="button"
            >
              <QrCode size={15} /> כניסה חדשה
            </button>
          )}
          <button
            className="button button--icon button--ghost"
            disabled={busy}
            onClick={() => void handleLogout()}
            type="button"
            aria-label="יציאה"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="appMain">
        {error && <InlineMessage tone="danger" text={error} />}

        {!configured && (
          <div className="banner">
            <div>
              <strong>מצב דמו — </strong>
              צור <code>.env.local</code> לפי <code>README.md</code> כדי להתחבר ל-Supabase.
            </div>
          </div>
        )}

        {/* Admin navigation tabs */}
        {profile.role === "admin" && (
          <div className="adminTabs" role="tablist">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`adminTab ${adminView === tab.id ? "adminTab--active" : ""}`}
                onClick={() => setAdminView(tab.id)}
                role="tab"
                aria-selected={adminView === tab.id}
                type="button"
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mashgiach dashboard */}
        {profile.role === "mashgiach" && mashgiachData && (
          <MashgiachDashboard data={mashgiachData} />
        )}

        {/* Admin: dashboard view */}
        {profile.role === "admin" && adminView === "dashboard" && adminData && (
          <AdminDashboardView
            data={adminData}
            filters={filters}
            filterOptions={filterOptions}
            onFiltersChange={setFilters}
            onApplyFilters={() => void loadDashboard(profile, filters)}
          />
        )}

        {/* Admin: locations */}
        {profile.role === "admin" && adminView === "locations" && <AdminLocations />}

        {/* Admin: mashgichim */}
        {profile.role === "admin" && adminView === "mashgichim" && <AdminMashgichim />}

        {/* Admin: reports (logs with delete) */}
        {profile.role === "admin" && adminView === "reports" && adminData && (
          <>
            <FiltersBar
              filters={filters}
              filterOptions={filterOptions}
              onChange={setFilters}
              onSubmit={() => void loadDashboard(profile, filters)}
              showAdminFilters
            />
            <div className="card">
              <div className="card__header">
                <div className="card__title">כל הדיווחים</div>
              </div>
              <div style={{ padding: "0 0 4px" }}>
                <AdminReports
                  logs={adminData.logs}
                  onDeleted={(id) =>
                    setAdminData((prev) =>
                      prev ? { ...prev, logs: prev.logs.filter((l) => l.id !== id) } : null
                    )
                  }
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* FAB for mashgiach on mobile */}
      {profile.role === "mashgiach" && (
        <button
          className="fab"
          onClick={() => setScannerOpen(true)}
          type="button"
          aria-label="סריקת כניסה חדשה"
        >
          <QrCode size={24} />
        </button>
      )}

      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => { void onScan(code); setScannerOpen(false); }}
      />

      {scanFeedback && (
        <ScanResultModal feedback={scanFeedback} onClose={() => setScanFeedback(null)} />
      )}
    </div>
  );
}

// ── Login ─────────────────────────────────────────

function LoginPanel({
  busy, configured, error, form, onChange, onDemoLogin, onSubmit,
}: {
  busy: boolean; configured: boolean; error: string | null;
  form: LoginFormState; onChange: (v: LoginFormState) => void;
  onDemoLogin: (role: Role) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="loginWrap">
      <div className="loginCard">
        <div className="loginCard__brand">
          <ShieldCheck size={26} />
          <h1>מעקב ביקורי משגיחים</h1>
        </div>

        {error && <InlineMessage tone="danger" text={error} />}

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>אימייל</span>
            <input autoComplete="email" dir="ltr" type="email"
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              placeholder="name@example.com" value={form.email} />
          </label>
          <label className="field">
            <span>סיסמה</span>
            <input autoComplete="current-password" dir="ltr" type="password"
              onChange={(e) => onChange({ ...form, password: e.target.value })}
              placeholder="••••••••" value={form.password} />
          </label>
          <button className="button button--primary button--wide" disabled={!configured || busy} type="submit">
            {busy ? "מתחבר..." : "התחברות"}
          </button>
        </form>

        {!configured && (
          <div className="demoBox">
            <h3>כניסת דמו</h3>
            <div className="demoBox__actions">
              <button className="button button--ghost" disabled={busy} onClick={() => onDemoLogin("mashgiach")} type="button">משגיח</button>
              <button className="button button--ghost" disabled={busy} onClick={() => onDemoLogin("admin")} type="button">מנהל</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filters ───────────────────────────────────────

function FiltersBar({
  filters, filterOptions, onChange, onSubmit, showAdminFilters,
}: {
  filters: DashboardFilters;
  filterOptions: { mashgichim: string[]; locations: string[]; cities: string[] };
  onChange: (f: DashboardFilters) => void;
  onSubmit: () => void;
  showAdminFilters?: boolean;
}) {
  return (
    <div className="card">
      <div className="card__header--inline">
        <span className="card__title" style={{ margin: 0 }}>סינון</span>
        <button className="button button--primary" onClick={onSubmit} type="button">החל</button>
      </div>
      <div className="card__body">
        <div className="filtersGrid">
          <label className="field">
            <span>מתאריך</span>
            <input onChange={(e) => onChange({ ...filters, from: e.target.value })} type="date" value={filters.from} />
          </label>
          <label className="field">
            <span>עד תאריך</span>
            <input onChange={(e) => onChange({ ...filters, to: e.target.value })} type="date" value={filters.to} />
          </label>
          {showAdminFilters && (
            <>
              <label className="field">
                <span>משגיח</span>
                <select onChange={(e) => onChange({ ...filters, mashgiachName: e.target.value })} value={filters.mashgiachName}>
                  <option value="">כולם</option>
                  {filterOptions.mashgichim.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="field">
                <span>מקום</span>
                <select onChange={(e) => onChange({ ...filters, locationName: e.target.value })} value={filters.locationName}>
                  <option value="">כולם</option>
                  {filterOptions.locations.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="field">
                <span>עיר</span>
                <select onChange={(e) => onChange({ ...filters, city: e.target.value })} value={filters.city}>
                  <option value="">כולן</option>
                  {filterOptions.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mashgiach dashboard ───────────────────────────

function MashgiachDashboard({ data }: { data: MashgiachDashboardData }) {
  return (
    <>
      <div className="statsGrid">
        <StatCard icon={<CheckCircle2 size={16} />} label="כניסות מוצלחות" value={String(data.metrics.successfulVisits)} />
        <StatCard icon={<AlertCircle size={16} />} label="כניסות חסומות" value={String(data.metrics.blockedVisits)} />
        <StatCard icon={<Building2 size={16} />} label="מקומות מורשים" value={String(data.metrics.allowedLocations)} />
        <StatCard icon={<Clock3 size={16} />} label="ביקור אחרון" value={data.metrics.lastVisitLabel ?? "עדיין לא"} />
      </div>
      <div className="card">
        <div className="card__header"><div className="card__title">הכניסות האחרונות שלי</div></div>
        <div style={{ padding: "0 0 4px" }}><LogsTable rows={data.logs} /></div>
      </div>
    </>
  );
}

// ── Admin dashboard view ──────────────────────────

function AdminDashboardView({
  data, filters, filterOptions, onFiltersChange, onApplyFilters,
}: {
  data: AdminDashboardData;
  filters: DashboardFilters;
  filterOptions: { mashgichim: string[]; locations: string[]; cities: string[] };
  onFiltersChange: (f: DashboardFilters) => void;
  onApplyFilters: () => void;
}) {
  return (
    <>
      <div className="statsGrid">
        <StatCard icon={<CheckCircle2 size={16} />} label="סה״כ כניסות" value={String(data.metrics.totalLogs)} />
        <StatCard icon={<Users size={16} />} label="משגיחים פעילים" value={String(data.metrics.activeMashgichim)} />
        <StatCard icon={<Building2 size={16} />} label="מקומות עם ביקורים" value={String(data.metrics.activeLocations)} />
        <StatCard icon={<CalendarDays size={16} />} label="חודש נוכחי" value={String(data.metrics.currentMonthVisits)} />
      </div>

      <FiltersBar
        filters={filters}
        filterOptions={filterOptions}
        onChange={onFiltersChange}
        onSubmit={onApplyFilters}
        showAdminFilters
      />

      <div className="card">
        <div className="card__header"><div className="card__title">כל הלוגים האחרונים</div></div>
        <div style={{ padding: "0 0 4px" }}><LogsTable rows={data.logs} /></div>
      </div>

      <div className="splitGrid">
        <div className="card">
          <div className="card__header"><div className="card__title">כניסות לפי מקום</div></div>
          <div style={{ padding: "0 0 4px" }}>
            <SummaryTable rows={data.byLocation} columns={[{ key: "locationName", label: "מקום" }, { key: "city", label: "עיר" }, { key: "count", label: "כניסות" }]} />
          </div>
        </div>
        <div className="card">
          <div className="card__header"><div className="card__title">ביקור אחרון לפי מיקום</div></div>
          <div style={{ padding: "0 0 4px" }}>
            <SummaryTable
              rows={data.latestByLocation.map((r) => ({ ...r, lastVisitAt: formatDateTime(r.lastVisitAt), ago: formatRelativeTime(r.lastVisitAt) }))}
              columns={[{ key: "locationName", label: "מקום" }, { key: "city", label: "עיר" }, { key: "mashgiachName", label: "משגיח" }, { key: "ago", label: "לפני" }]}
            />
          </div>
        </div>
      </div>

      <div className="splitGrid">
        <div className="card">
          <div className="card__header"><div className="card__title">סיכום שבועי</div></div>
          <div style={{ padding: "0 0 4px" }}>
            <SummaryTable rows={data.weeklySummary} columns={[{ key: "locationName", label: "מקום" }, { key: "city", label: "עיר" }, { key: "count", label: "כניסות" }]} />
          </div>
        </div>
        <div className="card">
          <div className="card__header"><div className="card__title">סיכום חודשי</div></div>
          <div style={{ padding: "0 0 4px" }}>
            <SummaryTable rows={data.monthlySummary} columns={[{ key: "locationName", label: "מקום" }, { key: "city", label: "עיר" }, { key: "count", label: "כניסות" }]} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Shared table components ───────────────────────

function LogsTable({ rows }: { rows: MashgiachDashboardData["logs"] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>תאריך ושעה</th><th>משגיח</th><th>מקום</th><th>עיר</th><th>סטטוס</th><th>הודעה</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.occurredAt)}</td>
                <td>{row.mashgiachName}</td>
                <td>{row.locationName ?? "לא זוהה"}</td>
                <td>{row.city ?? "-"}</td>
                <td><span className={`badge badge--${getStatusTone(row.status)}`}>{translateStatus(row.status)}</span></td>
                <td>{row.message}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={6} className="emptyRow">לא נמצאו לוגים.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({ columns, rows }: { columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number>> }) {
  return (
    <div className="tableWrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={`${i}-${String(row[columns[0].key])}`}>
                {columns.map((c) => <td key={c.key}>{row[c.key]}</td>)}
              </tr>
            ))
          ) : (
            <tr><td colSpan={columns.length} className="emptyRow">אין נתונים.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="statCard">
      <div className="statCard__icon">{icon}</div>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function InlineMessage({ text, tone }: { text: string; tone: "danger" | "success" }) {
  return (
    <div className={`message message--${tone}`}>
      {tone === "danger" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span>{text}</span>
    </div>
  );
}

function ScanResultModal({ feedback, onClose }: { feedback: ScanResult; onClose: () => void }) {
  const tone = getStatusTone(feedback.status);
  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal aria-labelledby="scan-result-title" onClick={(e) => e.stopPropagation()}>
        <div className="scanResult">
          <div className={`scanResult__icon scanResult__icon--${tone}`}>
            {tone === "success" ? <CheckCircle2 size={30} /> : <AlertCircle size={30} />}
          </div>
          <h2 id="scan-result-title">{translateStatus(feedback.status)}</h2>
          <p>{feedback.message}</p>
        </div>
        <button className="button button--primary button--wide" onClick={onClose} type="button">חזרה</button>
      </section>
    </div>
  );
}

function translateStatus(status: VisitStatus) {
  switch (status) {
    case "success": return "בוצע בהצלחה";
    case "unauthorized": return "לא מורשה";
    case "invalid_location": return "מקום לא תקין";
    case "error": default: return "שגיאה";
  }
}
