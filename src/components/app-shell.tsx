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

const EMPTY_LOGIN: LoginFormState = {
  email: "",
  password: "",
};

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
  const [mashgiachData, setMashgiachData] = useState<MashgiachDashboardData | null>(
    null,
  );
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanResult | null>(null);

  const configured = isSupabaseConfigured();

  const loadDashboard = useCallback(
    async (nextProfile: Profile, nextFilters: DashboardFilters, silent = false) => {
      if (!silent) {
        setRefreshing(true);
      }

      try {
        if (nextProfile.role === "mashgiach") {
          const data = await fetchMashgiachDashboard(nextProfile, nextFilters);
          setMashgiachData(data);
          setAdminData(null);
        } else {
          const data = await fetchAdminDashboard(nextProfile, nextFilters);
          setAdminData(data);
          setMashgiachData(null);
        }
      } catch (dashboardError) {
        setError(
          dashboardError instanceof Error
            ? dashboardError.message
            : "אירעה תקלה בטעינת הנתונים.",
        );
      } finally {
        if (!silent) {
          setRefreshing(false);
        }
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
        if (!active) {
          return;
        }

        setProfile(activeProfile);
        setError(null);

        if (activeProfile) {
          await loadDashboard(activeProfile, EMPTY_FILTERS);
        }
      } catch (bootstrapError) {
        if (!active) {
          return;
        }

        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "לא הצלחנו לזהות משתמש מחובר.",
        );
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!profile) {
      return;
    }

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
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "ההתחברות נכשלה.",
      );
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
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "לא הצלחנו להתנתק.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async (role: Role) => {
    setBusy(true);
    setError(null);

    try {
      const nextProfile = await getCurrentSessionProfile(role);
      if (!nextProfile) {
        throw new Error("לא נמצא משתמש דמו.");
      }

      setProfile(nextProfile);
      setFilters(EMPTY_FILTERS);
      await loadDashboard(nextProfile, EMPTY_FILTERS);
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : "כניסת הדמו נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    if (!profile) {
      return;
    }

    await loadDashboard(profile, filters);
  };

  const onScan = async (qrCode: string) => {
    if (!profile) {
      return;
    }

    setBusy(true);
    try {
      const result = await submitVisitScan(profile, qrCode);
      setScanFeedback(result);
      await loadDashboard(profile, filters, true);
    } catch (scanError) {
      setScanFeedback({
        status: "error",
        message: scanError instanceof Error ? scanError.message : "הסריקה נכשלה.",
      });
    } finally {
      setBusy(false);
    }
  };

  const activeDataTitle = useMemo(() => {
    if (!profile) {
      return "מעקב ביקורי משגיחים";
    }

    return profile.role === "admin" ? "דשבורד מנהל" : "דשבורד משגיח";
  }, [profile]);

  return (
    <div className="shell">
      <div className="shell__backdrop" />
      <main className="shell__content">
        <section className="hero">
          <div className="hero__copy">
            <span className="hero__eyebrow">
              <ShieldCheck size={16} />
              בקרה שוטפת בזמן אמת
            </span>
            <h1>{activeDataTitle}</h1>
          </div>

          <div className="hero__status">
            <StatusChip
              icon={<RefreshCw size={16} />}
              label="רענון אוטומטי"
              value="כל דקה"
            />
            <StatusChip
              icon={<QrCode size={16} />}
              label="סריקת כניסה"
              value="QR בזמן אמת"
            />
            <StatusChip
              icon={<Users size={16} />}
              label="מצב מערכת"
              value={configured ? "מחוברת ל-Supabase" : "מצב דמו עד חיבור"}
            />
          </div>
        </section>

        {error ? <InlineMessage tone="danger" text={error} /> : null}

        {!configured ? (
          <section className="setupBanner">
            <strong>מצב דמו</strong>
            <p>צור <code>.env.local</code> לפי <code>README.md</code> כדי להתחבר ל-Supabase.</p>
          </section>
        ) : null}

        {loadingProfile ? (
          <section className="panel panel--centered">
            <RefreshCw size={18} className="spin" />
            טוען מערכת...
          </section>
        ) : profile ? (
          <>
            <section className="toolbar">
              <div className="toolbar__user">
                <div>
                  <strong>{profile.fullName}</strong>
                  <span>{profile.role === "admin" ? "מנהל" : "משגיח"}</span>
                </div>
              </div>

              <div className="toolbar__actions">
                <button
                  className="button button--ghost"
                  onClick={() => void onRefresh()}
                  disabled={refreshing || busy}
                  type="button"
                >
                  <RefreshCw size={16} className={refreshing ? "spin" : ""} />
                  רענון
                </button>
                {profile.role === "mashgiach" ? (
                  <button
                    className="button button--primary"
                    onClick={() => setScannerOpen(true)}
                    type="button"
                  >
                    <QrCode size={16} />
                    כניסה חדשה
                  </button>
                ) : null}
                <button
                  className="button button--ghost"
                  onClick={() => void handleLogout()}
                  disabled={busy}
                  type="button"
                >
                  <LogOut size={16} />
                  יציאה
                </button>
              </div>
            </section>

            <FiltersBar
              profile={profile}
              filters={filters}
              onChange={(nextFilters) => setFilters(nextFilters)}
              onSubmit={() => void loadDashboard(profile, filters)}
            />

            {profile.role === "mashgiach" && mashgiachData ? (
              <MashgiachDashboard data={mashgiachData} />
            ) : null}

            {profile.role === "admin" && adminData ? (
              <AdminDashboard data={adminData} />
            ) : null}
          </>
        ) : (
          <LoginPanel
            busy={busy}
            configured={configured}
            form={loginForm}
            onChange={setLoginForm}
            onSubmit={handleLogin}
            onDemoLogin={handleDemoLogin}
          />
        )}
      </main>

      <QrScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          void onScan(code);
          setScannerOpen(false);
        }}
      />

      {scanFeedback ? (
        <ScanResultModal
          feedback={scanFeedback}
          onClose={() => setScanFeedback(null)}
        />
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
}: {
  busy: boolean;
  configured: boolean;
  form: LoginFormState;
  onChange: (value: LoginFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDemoLogin: (role: Role) => void;
}) {
  return (
    <section className="login">
      <div className="panel login__panel">
        <div className="panel__header">
          <h2>התחברות למערכת</h2>
        </div>

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>אימייל</span>
            <input
              autoComplete="email"
              dir="ltr"
              onChange={(event) =>
                onChange({ ...form, email: event.target.value })
              }
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
              onChange={(event) =>
                onChange({ ...form, password: event.target.value })
              }
              placeholder="********"
              type="password"
              value={form.password}
            />
          </label>

          <button className="button button--primary button--wide" disabled={!configured || busy} type="submit">
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
                type="button"
              >
                דמו משגיח
              </button>
              <button
                className="button button--ghost"
                onClick={() => onDemoLogin("admin")}
                type="button"
              >
                דמו מנהל
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
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
    <section className="panel filters">
      <div className="panel__header panel__header--inline">
        <div>
          <h2>חיפוש וסינון</h2>
        </div>
        <button className="button button--primary" onClick={onSubmit} type="button">
          החל סינון
        </button>
      </div>

      <div className="filters__grid">
        <label className="field">
          <span>מתאריך</span>
          <input
            onChange={(event) => onChange({ ...filters, from: event.target.value })}
            type="date"
            value={filters.from}
          />
        </label>
        <label className="field">
          <span>עד תאריך</span>
          <input
            onChange={(event) => onChange({ ...filters, to: event.target.value })}
            type="date"
            value={filters.to}
          />
        </label>

        {profile.role === "admin" ? (
          <>
            <label className="field">
              <span>משגיח</span>
              <input
                onChange={(event) =>
                  onChange({ ...filters, mashgiachName: event.target.value })
                }
                placeholder="שם משגיח"
                value={filters.mashgiachName}
              />
            </label>
            <label className="field">
              <span>מקום</span>
              <input
                onChange={(event) =>
                  onChange({ ...filters, locationName: event.target.value })
                }
                placeholder="שם מקום"
                value={filters.locationName}
              />
            </label>
            <label className="field">
              <span>עיר</span>
              <input
                onChange={(event) => onChange({ ...filters, city: event.target.value })}
                placeholder="עיר"
                value={filters.city}
              />
            </label>
          </>
        ) : null}
      </div>
    </section>
  );
}

function MashgiachDashboard({ data }: { data: MashgiachDashboardData }) {
  return (
    <div className="dashboard">
      <section className="statsGrid">
        <StatCard icon={<CheckCircle2 size={18} />} label="כניסות מוצלחות" value={String(data.metrics.successfulVisits)} />
        <StatCard icon={<AlertCircle size={18} />} label="כניסות חסומות" value={String(data.metrics.blockedVisits)} />
        <StatCard icon={<Building2 size={18} />} label="מקומות מורשים" value={String(data.metrics.allowedLocations)} />
        <StatCard
          icon={<Clock3 size={18} />}
          label="ביקור אחרון"
          value={data.metrics.lastVisitLabel ?? "עדיין לא בוצע"}
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>הכניסות האחרונות שלי</h2>
        </div>
        <LogsTable rows={data.logs} />
      </section>
    </div>
  );
}

function AdminDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <div className="dashboard">
      <section className="statsGrid">
        <StatCard icon={<CheckCircle2 size={18} />} label="סה״כ כניסות" value={String(data.metrics.totalLogs)} />
        <StatCard icon={<Users size={18} />} label="משגיחים פעילים" value={String(data.metrics.activeMashgichim)} />
        <StatCard icon={<Building2 size={18} />} label="מקומות עם ביקורים" value={String(data.metrics.activeLocations)} />
        <StatCard icon={<CalendarDays size={18} />} label="חודש נוכחי" value={String(data.metrics.currentMonthVisits)} />
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>כל הלוגים האחרונים</h2>
        </div>
        <LogsTable rows={data.logs} />
      </section>

      <section className="splitGrid">
        <section className="panel">
          <div className="panel__header">
            <h2>כניסות לפי מקום</h2>
          </div>
          <SummaryTable
            rows={data.byLocation}
            columns={[
              { key: "locationName", label: "מקום" },
              { key: "city", label: "עיר" },
              { key: "count", label: "מספר כניסות" },
            ]}
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>ביקור אחרון לפי מיקום</h2>
          </div>
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
              { key: "lastVisitAt", label: "מתי" },
              { key: "ago", label: "כמה זמן עבר" },
            ]}
          />
        </section>
      </section>

      <section className="splitGrid">
        <section className="panel">
          <div className="panel__header">
            <h2>סיכום שבועי</h2>
          </div>
          <SummaryTable
            rows={data.weeklySummary}
            columns={[
              { key: "locationName", label: "מקום" },
              { key: "city", label: "עיר" },
              { key: "count", label: "כניסות" },
            ]}
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>סיכום חודשי</h2>
          </div>
          <SummaryTable
            rows={data.monthlySummary}
            columns={[
              { key: "locationName", label: "מקום" },
              { key: "city", label: "עיר" },
              { key: "count", label: "כניסות" },
            ]}
          />
        </section>
      </section>
    </div>
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
                לא נמצאו לוגים בטווח הסינון.
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
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${String(row[columns[0].key])}`}>
                {columns.map((column) => (
                  <td key={column.key}>{row[column.key]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="emptyRow">
                אין נתונים להצגה.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="statusChip">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
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
    <section className={`panel message message--${tone}`}>
      {tone === "danger" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{text}</span>
    </section>
  );
}

function ScanResultModal({
  feedback,
  onClose,
}: {
  feedback: ScanResult;
  onClose: () => void;
}) {
  const tone = getStatusTone(feedback.status);

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="scan-result-title">
        <div className={`resultIcon resultIcon--${tone}`}>
          {tone === "success" ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
        </div>
        <h2 id="scan-result-title">{translateStatus(feedback.status)}</h2>
        <p>{feedback.message}</p>
        <button className="button button--primary button--wide" onClick={onClose} type="button">
          חזרה למסך הראשי
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
