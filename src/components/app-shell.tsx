"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
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

const REFRESH_INTERVAL_MS = 60_000;
const EMPTY_LOGIN: LoginFormState = { email: "", password: "" };
const EMPTY_FILTERS: DashboardFilters = {
  from: "",
  to: "",
  mashgiachName: "",
  locationName: "",
  city: "",
};

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

  const configured = isSupabaseConfigured();

  const loadDashboard = useCallback(
    async (nextProfile: Profile, nextFilters: DashboardFilters, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        if (nextProfile.role === "mashgiach") {
          setMashgiachData(await fetchMashgiachDashboard(nextProfile, nextFilters));
          setAdminData(null);
        } else {
          setAdminData(await fetchAdminDashboard(nextProfile, nextFilters));
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
        const activeProfile = await getCurrentSessionProfile();
        if (!active) return;
        setProfile(activeProfile);
        setError(null);
        if (activeProfile) await loadDashboard(activeProfile, EMPTY_FILTERS);
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
    const interval = window.setInterval(() => {
      void loadDashboard(profile, filters, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [filters, loadDashboard, profile]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const nextProfile = await signInWithEmail(loginForm.email, loginForm.password);
      setProfile(nextProfile);
      setFilters(EMPTY_FILTERS);
      await loadDashboard(nextProfile, EMPTY_FILTERS);
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
      const nextProfile = await getCurrentSessionProfile(role);
      if (!nextProfile) throw new Error("לא נמצא משתמש דמו.");
      setProfile(nextProfile);
      setFilters(EMPTY_FILTERS);
      await loadDashboard(nextProfile, EMPTY_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "כניסת הדמו נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    if (!profile) return;
    await loadDashboard(profile, filters);
  };

  const onScan = async (qrCode: string) => {
    if (!profile) return;
    setBusy(true);
    try {
      const result = await submitVisitScan(profile, qrCode);
      setScanFeedback(result);
      await loadDashboard(profile, filters, true);
    } catch (err) {
      setScanFeedback({
        status: "error",
        message: err instanceof Error ? err.message : "הסריקה נכשלה.",
      });
    } finally {
      setBusy(false);
    }
  };

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
          form={loginForm}
          onChange={setLoginForm}
          onSubmit={handleLogin}
          onDemoLogin={handleDemoLogin}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="app">
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
            onClick={() => void onRefresh()}
            disabled={refreshing || busy}
            type="button"
            aria-label="רענון"
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          </button>

          {profile.role === "mashgiach" ? (
            <button
              className="button button--primary headerScanBtn"
              onClick={() => setScannerOpen(true)}
              type="button"
            >
              <QrCode size={15} />
              כניסה חדשה
            </button>
          ) : null}

          <button
            className="button button--icon button--ghost"
            onClick={() => void handleLogout()}
            disabled={busy}
            type="button"
            aria-label="יציאה"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="appMain">
        {error ? <InlineMessage tone="danger" text={error} /> : null}

        {!configured ? (
          <div className="banner">
            <div>
              <strong>מצב דמו</strong>
              צור <code>.env.local</code> לפי <code>README.md</code> כדי להתחבר ל-Supabase.
            </div>
          </div>
        ) : null}

        <FiltersBar
          profile={profile}
          filters={filters}
          onChange={setFilters}
          onSubmit={() => void loadDashboard(profile, filters)}
        />

        {profile.role === "mashgiach" && mashgiachData ? (
          <MashgiachDashboard data={mashgiachData} />
        ) : null}

        {profile.role === "admin" && adminData ? (
          <AdminDashboard data={adminData} />
        ) : null}
      </main>

      {profile.role === "mashgiach" ? (
        <button
          className="fab"
          onClick={() => setScannerOpen(true)}
          type="button"
          aria-label="סריקת כניסה חדשה"
        >
          <QrCode size={24} />
        </button>
      ) : null}

      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          void onScan(code);
          setScannerOpen(false);
        }}
      />

      {scanFeedback ? (
        <ScanResultModal feedback={scanFeedback} onClose={() => setScanFeedback(null)} />
      ) : null}
    </div>
  );
}

function LoginPanel({
  busy,
  configured,
  form,
  onChange,
  onSubmit,
  onDemoLogin,
  error,
}: {
  busy: boolean;
  configured: boolean;
  form: LoginFormState;
  onChange: (value: LoginFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDemoLogin: (role: Role) => void;
  error: string | null;
}) {
  return (
    <div className="loginWrap">
      <div className="loginCard">
        <div className="loginCard__brand">
          <ShieldCheck size={26} />
          <h1>מעקב ביקורי משגיחים</h1>
        </div>

        {error ? <InlineMessage tone="danger" text={error} /> : null}

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>אימייל</span>
            <input
              autoComplete="email"
              dir="ltr"
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              placeholder="name@example.com"
              type="email"
              value={form.email}
            />
          </label>

          <label className="field">
            <span>סיסמה</span>
            <input
              autoComplete="current-password"
              dir="ltr"
              onChange={(e) => onChange({ ...form, password: e.target.value })}
              placeholder="••••••••"
              type="password"
              value={form.password}
            />
          </label>

          <button
            className="button button--primary button--wide"
            disabled={!configured || busy}
            type="submit"
          >
            {busy ? "מתחבר..." : "התחברות"}
          </button>
        </form>

        {!configured ? (
          <div className="demoBox">
            <h3>כניסת דמו</h3>
            <div className="demoBox__actions">
              <button
                className="button button--ghost"
                onClick={() => onDemoLogin("mashgiach")}
                disabled={busy}
                type="button"
              >
                משגיח
              </button>
              <button
                className="button button--ghost"
                onClick={() => onDemoLogin("admin")}
                disabled={busy}
                type="button"
              >
                מנהל
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FiltersBar({
  filters,
  onChange,
  onSubmit,
  profile,
}: {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onSubmit: () => void;
  profile: Profile;
}) {
  return (
    <div className="card">
      <div className="card__header--inline">
        <span className="card__title" style={{ margin: 0 }}>סינון</span>
        <button className="button button--primary" onClick={onSubmit} type="button">
          החל
        </button>
      </div>
      <div className="card__body">
        <div className="filtersGrid">
          <label className="field">
            <span>מתאריך</span>
            <input
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
              type="date"
              value={filters.from}
            />
          </label>
          <label className="field">
            <span>עד תאריך</span>
            <input
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
              type="date"
              value={filters.to}
            />
          </label>

          {profile.role === "admin" ? (
            <>
              <label className="field">
                <span>משגיח</span>
                <input
                  onChange={(e) => onChange({ ...filters, mashgiachName: e.target.value })}
                  placeholder="שם משגיח"
                  value={filters.mashgiachName}
                />
              </label>
              <label className="field">
                <span>מקום</span>
                <input
                  onChange={(e) => onChange({ ...filters, locationName: e.target.value })}
                  placeholder="שם מקום"
                  value={filters.locationName}
                />
              </label>
              <label className="field">
                <span>עיר</span>
                <input
                  onChange={(e) => onChange({ ...filters, city: e.target.value })}
                  placeholder="עיר"
                  value={filters.city}
                />
              </label>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
        <div className="card__header">
          <div className="card__title">הכניסות האחרונות שלי</div>
        </div>
        <div className="card__body" style={{ padding: "0 0 4px" }}>
          <LogsTable rows={data.logs} />
        </div>
      </div>
    </>
  );
}

function AdminDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <>
      <div className="statsGrid">
        <StatCard icon={<CheckCircle2 size={16} />} label="סה״כ כניסות" value={String(data.metrics.totalLogs)} />
        <StatCard icon={<Users size={16} />} label="משגיחים פעילים" value={String(data.metrics.activeMashgichim)} />
        <StatCard icon={<Building2 size={16} />} label="מקומות עם ביקורים" value={String(data.metrics.activeLocations)} />
        <StatCard icon={<CalendarDays size={16} />} label="חודש נוכחי" value={String(data.metrics.currentMonthVisits)} />
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">כל הלוגים האחרונים</div>
        </div>
        <div className="card__body" style={{ padding: "0 0 4px" }}>
          <LogsTable rows={data.logs} />
        </div>
      </div>

      <div className="splitGrid">
        <div className="card">
          <div className="card__header">
            <div className="card__title">כניסות לפי מקום</div>
          </div>
          <div className="card__body" style={{ padding: "0 0 4px" }}>
            <SummaryTable
              rows={data.byLocation}
              columns={[
                { key: "locationName", label: "מקום" },
                { key: "city", label: "עיר" },
                { key: "count", label: "כניסות" },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <div className="card__title">ביקור אחרון לפי מיקום</div>
          </div>
          <div className="card__body" style={{ padding: "0 0 4px" }}>
            <SummaryTable
              rows={data.latestByLocation.map((row) => ({
                ...row,
                lastVisitAt: formatDateTime(row.lastVisitAt),
                ago: formatRelativeTime(row.lastVisitAt),
              }))}
              columns={[
                { key: "locationName", label: "מקום" },
                { key: "city", label: "עיר" },
                { key: "mashgiachName", label: "משגיח אחרון" },
                { key: "ago", label: "לפני" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="splitGrid">
        <div className="card">
          <div className="card__header">
            <div className="card__title">סיכום שבועי</div>
          </div>
          <div className="card__body" style={{ padding: "0 0 4px" }}>
            <SummaryTable
              rows={data.weeklySummary}
              columns={[
                { key: "locationName", label: "מקום" },
                { key: "city", label: "עיר" },
                { key: "count", label: "כניסות" },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <div className="card__title">סיכום חודשי</div>
          </div>
          <div className="card__body" style={{ padding: "0 0 4px" }}>
            <SummaryTable
              rows={data.monthlySummary}
              columns={[
                { key: "locationName", label: "מקום" },
                { key: "city", label: "עיר" },
                { key: "count", label: "כניסות" },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function LogsTable({ rows }: { rows: MashgiachDashboardData["logs"] }) {
  return (
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
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const tone = getStatusTone(row.status);
              return (
                <tr key={row.id}>
                  <td>{formatDateTime(row.occurredAt)}</td>
                  <td>{row.mashgiachName}</td>
                  <td>{row.locationName ?? "לא זוהה"}</td>
                  <td>{row.city ?? "-"}</td>
                  <td>
                    <span className={`badge badge--${tone}`}>{translateStatus(row.status)}</span>
                  </td>
                  <td>{row.message}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="emptyRow">
                לא נמצאו לוגים.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({
  columns,
  rows,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number>>;
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={`${i}-${String(row[columns[0].key])}`}>
                {columns.map((col) => (
                  <td key={col.key}>{row[col.key]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="emptyRow">
                אין נתונים.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

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
      <section
        className="modal"
        role="dialog"
        aria-modal
        aria-labelledby="scan-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scanResult">
          <div className={`scanResult__icon scanResult__icon--${tone}`}>
            {tone === "success" ? <CheckCircle2 size={30} /> : <AlertCircle size={30} />}
          </div>
          <h2 id="scan-result-title">{translateStatus(feedback.status)}</h2>
          <p>{feedback.message}</p>
        </div>
        <button className="button button--primary button--wide" onClick={onClose} type="button">
          חזרה
        </button>
      </section>
    </div>
  );
}

function translateStatus(status: VisitStatus) {
  switch (status) {
    case "success":
      return "בוצע בהצלחה";
    case "unauthorized":
      return "לא מורשה";
    case "invalid_location":
      return "מקום לא תקין";
    case "error":
    default:
      return "שגיאה";
  }
}
