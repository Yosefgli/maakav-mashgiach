import { getMockAllowedLocationsCount, getMockLogs, getMockProfile, runMockScan } from "./mock-data";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  AdminDashboardData,
  MashgiachDashboardData,
  Profile,
  Role,
  ScanResult,
  VisitLog,
} from "./types";
import { filterLogs, formatDateTime } from "./utils";

export type DashboardFilters = {
  from: string;
  to: string;
  mashgiachName: string;
  locationName: string;
  city: string;
};

type VisitLogRow = {
  id: string;
  occurred_at: string;
  occurred_date: string;
  occurred_time: string;
  mashgiach_display_name: string;
  location_display_name: string | null;
  city: string | null;
  status: VisitLog["status"];
  message: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  full_name: string;
  role: Role;
};

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function getCurrentSessionProfile(mockRole?: Role) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return mockRole ? getMockProfile(mockRole) : null;
  }

  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    return null;
  }

  return fetchProfileByUserId(session.user.id, session.user.email ?? "");
}

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("יש להגדיר NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error("פרטי ההתחברות שגויים או שהמשתמש אינו פעיל.");
  }

  return fetchProfileByUserId(data.user.id, data.user.email ?? email);
}

export async function signOutCurrentUser() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function fetchMashgiachDashboard(
  profile: Profile,
  filters: DashboardFilters,
): Promise<MashgiachDashboardData> {
  const logs = await fetchLogs(profile, filters);
  const successfulVisits = logs.filter((log) => log.status === "success").length;
  const blockedVisits = logs.filter((log) => log.status !== "success").length;
  const lastVisit = logs.find((log) => log.status === "success");

  let allowedLocations = getMockAllowedLocationsCount();
  const client = getSupabaseBrowserClient();

  if (client) {
    const { count } = await client
      .from("mashgiach_locations")
      .select("*", { head: true, count: "exact" })
      .eq("mashgiach_user_id", profile.userId);

    allowedLocations = count ?? 0;
  }

  return {
    logs,
    metrics: {
      successfulVisits,
      blockedVisits,
      allowedLocations,
      lastVisitLabel: lastVisit ? formatDateTime(lastVisit.occurredAt) : null,
    },
  };
}

export async function fetchAdminDashboard(
  profile: Profile,
  filters: DashboardFilters,
): Promise<AdminDashboardData> {
  const logs = await fetchLogs(profile, filters);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const uniqueMashgichim = new Set(logs.map((log) => log.mashgiachName));
  const uniqueLocations = new Set(
    logs.map((log) => `${log.locationName ?? "לא זוהה"}-${log.city ?? ""}`),
  );

  return {
    logs,
    metrics: {
      totalLogs: logs.length,
      activeMashgichim: uniqueMashgichim.size,
      activeLocations: uniqueLocations.size,
      currentMonthVisits: logs.filter((log) => log.occurredDate.startsWith(currentMonth)).length,
    },
    byLocation: summarizeByLocation(logs),
    weeklySummary: summarizeByLocation(
      logs.filter(
        (log) =>
          new Date(log.occurredAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000,
      ),
    ),
    monthlySummary: summarizeByLocation(
      logs.filter(
        (log) =>
          new Date(log.occurredAt).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000,
      ),
    ),
    latestByLocation: latestVisitByLocation(logs),
  };
}

export async function submitVisitScan(profile: Profile, qrCode: string): Promise<ScanResult> {
  if (!qrCode.trim()) {
    return {
      status: "error",
      message: "יש להזין או לסרוק קוד מקום לפני שליחה.",
    };
  }

  const client = getSupabaseBrowserClient();
  if (!client) {
    return runMockScan(profile, qrCode);
  }

  const { data, error } = await client.rpc("register_visit_by_qr", {
    p_qr_code: qrCode,
  });

  if (error) {
    throw new Error("הפעולה נכשלה בצד השרת. בדוק שהפונקציה register_visit_by_qr קיימת.");
  }

  return {
    status: data.status,
    message: data.message,
  };
}

async function fetchProfileByUserId(userId: string, fallbackEmail: string) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("מצב דמו בלבד.");
  }

  const { data, error } = await client
    .from("profiles")
    .select("user_id, email, full_name, role")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("לא נמצא פרופיל למשתמש המחובר.");
  }

  const profile = data as ProfileRow;

  return {
    userId: profile.user_id,
    email: profile.email || fallbackEmail,
    fullName: profile.full_name,
    role: profile.role,
  } satisfies Profile;
}

async function fetchLogs(profile: Profile, filters: DashboardFilters) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    const demoLogs =
      profile.role === "admin"
        ? getMockLogs()
        : getMockLogs().filter((log) => log.mashgiachName === profile.fullName);
    return filterLogs(demoLogs, filters);
  }

  let query = client
    .from("visit_logs")
    .select(
      "id, occurred_at, occurred_date, occurred_time, mashgiach_display_name, location_display_name, city, status, message",
    )
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (profile.role === "mashgiach") {
    query = query.eq("mashgiach_user_id", profile.userId);
  }

  if (filters.from) {
    query = query.gte("occurred_date", filters.from);
  }

  if (filters.to) {
    query = query.lte("occurred_date", filters.to);
  }

  if (profile.role === "admin" && filters.mashgiachName) {
    query = query.ilike("mashgiach_display_name", `%${filters.mashgiachName}%`);
  }

  if (profile.role === "admin" && filters.locationName) {
    query = query.ilike("location_display_name", `%${filters.locationName}%`);
  }

  if (profile.role === "admin" && filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as VisitLogRow[]).map(mapVisitLogRow);
}

function mapVisitLogRow(row: VisitLogRow): VisitLog {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    occurredDate: row.occurred_date,
    occurredTime: row.occurred_time,
    mashgiachName: row.mashgiach_display_name,
    locationName: row.location_display_name,
    city: row.city,
    status: row.status,
    message: row.message,
  };
}

function summarizeByLocation(logs: VisitLog[]) {
  const summary = new Map<string, { locationName: string; city: string; count: number }>();

  for (const log of logs) {
    const locationName = log.locationName ?? "לא זוהה";
    const city = log.city ?? "-";
    const key = `${locationName}-${city}`;
    const current = summary.get(key);

    if (current) {
      current.count += 1;
    } else {
      summary.set(key, { locationName, city, count: 1 });
    }
  }

  return [...summary.values()].sort((a, b) => b.count - a.count);
}

function latestVisitByLocation(logs: VisitLog[]) {
  const latest = new Map<
    string,
    { locationName: string; city: string; mashgiachName: string; lastVisitAt: string }
  >();

  for (const log of logs) {
    const locationName = log.locationName ?? "לא זוהה";
    const city = log.city ?? "-";
    const key = `${locationName}-${city}`;
    const existing = latest.get(key);

    if (!existing || existing.lastVisitAt < log.occurredAt) {
      latest.set(key, {
        locationName,
        city,
        mashgiachName: log.mashgiachName,
        lastVisitAt: log.occurredAt,
      });
    }
  }

  return [...latest.values()].sort((a, b) =>
    a.lastVisitAt < b.lastVisitAt ? 1 : -1,
  );
}
