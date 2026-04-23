import {
  addMockLocation,
  addMockUser,
  deleteMockLocation,
  deleteMockLog,
  deleteMockUser,
  getMockAllowedLocationsCount,
  getMockLocations,
  getMockLogs,
  getMockProfile,
  getMockUsers,
  runMockScan,
  toggleMockAssignment,
  updateMockLocation,
  updateMockLog,
} from "./mock-data";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  AdminDashboardData,
  GpsCoords,
  Location,
  MashgiachDashboardData,
  Profile,
  Role,
  ScanResult,
  UserRecord,
  VisitLog,
} from "./types";
import { filterLogs, formatDateTime, haversineMeters } from "./utils";

export type DashboardFilters = {
  from: string;
  to: string;
  mashgiachNames: string[];
  locationNames: string[];
  cities: string[];
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
  created_at: string;
};

type LocationRow = {
  id: string;
  name: string;
  city: string;
  qr_code: string;
  is_active: boolean;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
};

type AssignmentRow = {
  mashgiach_user_id: string;
  location_id: string;
};

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// ── Auth ─────────────────────────────────────────

export async function getCurrentSessionProfile(mockRole?: Role) {
  const client = getSupabaseBrowserClient();
  if (!client) return mockRole ? getMockProfile(mockRole) : null;

  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session?.user) return null;
  return fetchProfileByUserId(session.user.id, session.user.email ?? "");
}

export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("יש להגדיר את משתני הסביבה של Supabase.");

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("פרטי ההתחברות שגויים או שהמשתמש אינו פעיל.");
  return fetchProfileByUserId(data.user.id, data.user.email ?? email);
}

export async function signOutCurrentUser() {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

// ── Dashboards ────────────────────────────────────

export async function fetchMashgiachDashboard(
  profile: Profile,
  filters: DashboardFilters,
): Promise<MashgiachDashboardData> {
  const logs = await fetchLogs(profile, filters);
  const successfulVisits = logs.filter((l) => l.status === "success").length;
  const blockedVisits = logs.filter((l) => l.status !== "success").length;
  const lastVisit = logs.find((l) => l.status === "success");

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
  const uniqueMashgichim = new Set(logs.map((l) => l.mashgiachName));
  const uniqueLocations = new Set(logs.map((l) => `${l.locationName ?? ""}-${l.city ?? ""}`));

  return {
    logs,
    metrics: {
      totalLogs: logs.length,
      activeMashgichim: uniqueMashgichim.size,
      activeLocations: uniqueLocations.size,
      currentMonthVisits: logs.filter((l) => l.occurredDate.startsWith(currentMonth)).length,
    },
    byLocation: summarizeByLocation(logs),
    weeklySummary: summarizeByLocation(logs.filter((l) => new Date(l.occurredAt).getTime() >= Date.now() - 7 * 86400000)),
    monthlySummary: summarizeByLocation(logs.filter((l) => new Date(l.occurredAt).getTime() >= Date.now() - 30 * 86400000)),
    latestByLocation: latestVisitByLocation(logs),
  };
}

export async function submitVisitScan(profile: Profile, qrCode: string, coords?: GpsCoords): Promise<ScanResult> {
  if (!qrCode.trim()) return { status: "error", message: "יש להזין או לסרוק קוד מקום לפני שליחה." };

  const client = getSupabaseBrowserClient();
  if (!client) return runMockScan(profile, qrCode, coords);

  const { data, error } = await client.rpc("register_visit_by_qr", { p_qr_code: qrCode });
  if (error) throw new Error("הפעולה נכשלה בצד השרת.");

  // Client-side distance check using location coords returned by RPC
  let distanceMeters: number | null = null;
  if (coords && data.location_latitude != null && data.location_longitude != null) {
    distanceMeters = haversineMeters(coords.latitude, coords.longitude, data.location_latitude as number, data.location_longitude as number);
  }

  return { status: data.status as ScanResult["status"], message: data.message as string, locationName: data.location_name as string | undefined, distanceMeters };
}

// ── Locations ─────────────────────────────────────

export async function fetchLocations(): Promise<Location[]> {
  const client = getSupabaseBrowserClient();
  if (!client) return getMockLocations();

  const { data, error } = await client
    .from("locations")
    .select("id, name, city, qr_code, is_active, created_at, latitude, longitude")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as LocationRow[]).map(mapLocation);
}

export async function createLocation(input: { name: string; city: string; qrCode: string; latitude?: number | null; longitude?: number | null }): Promise<Location> {
  const client = getSupabaseBrowserClient();
  if (!client) return addMockLocation(input);

  const { data, error } = await client
    .from("locations")
    .insert({ name: input.name, city: input.city, qr_code: input.qrCode, latitude: input.latitude ?? null, longitude: input.longitude ?? null })
    .select()
    .single();
  if (error) throw error;
  return mapLocation(data as LocationRow);
}

export async function updateLocation(id: string, input: Partial<{ name: string; city: string; isActive: boolean; latitude: number | null; longitude: number | null }>): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { updateMockLocation(id, input); return; }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;

  const { error } = await client.from("locations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLocation(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { deleteMockLocation(id); return; }

  const { error } = await client.from("locations").delete().eq("id", id);
  if (error) throw error;
}

// ── Users / Mashgichim ────────────────────────────

export async function fetchUsers(): Promise<UserRecord[]> {
  const client = getSupabaseBrowserClient();
  if (!client) return getMockUsers();

  const [{ data: profiles, error: profilesError }, { data: assignments, error: assignError }] =
    await Promise.all([
      client.from("profiles").select("user_id, email, full_name, role, created_at").order("created_at"),
      client.from("mashgiach_locations").select("mashgiach_user_id, location_id"),
    ]);

  if (profilesError) throw profilesError;
  if (assignError) throw assignError;

  return ((profiles ?? []) as ProfileRow[]).map((p) => ({
    userId: p.user_id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    createdAt: p.created_at,
    assignedLocationIds: ((assignments ?? []) as AssignmentRow[])
      .filter((a) => a.mashgiach_user_id === p.user_id)
      .map((a) => a.location_id),
  }));
}

export async function createUser(input: { email: string; fullName: string; password: string; role: Role }): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { addMockUser({ email: input.email, fullName: input.fullName, role: input.role }); return; }

  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "יצירת המשתמש נכשלה.");
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { deleteMockUser(userId); return; }

  const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "מחיקת המשתמש נכשלה.");
  }
}

export async function setLocationAssignment(mashgiachId: string, locationId: string, assign: boolean): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { toggleMockAssignment(mashgiachId, locationId, assign); return; }

  if (assign) {
    const { error } = await client
      .from("mashgiach_locations")
      .insert({ mashgiach_user_id: mashgiachId, location_id: locationId });
    if (error && !error.message.includes("unique")) throw error;
  } else {
    const { error } = await client
      .from("mashgiach_locations")
      .delete()
      .eq("mashgiach_user_id", mashgiachId)
      .eq("location_id", locationId);
    if (error) throw error;
  }
}

// ── Visit logs ────────────────────────────────────

export async function deleteVisitLog(id: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { deleteMockLog(id); return; }

  const { error } = await client.from("visit_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function updateVisitLog(id: string, data: { status: VisitLog["status"]; message: string }): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) { updateMockLog(id, data); return; }

  const { error } = await client.from("visit_logs").update({ status: data.status, message: data.message }).eq("id", id);
  if (error) throw error;
}

// ── Real-time ─────────────────────────────────────

export function subscribeToLogs(callback: () => void): (() => void) | null {
  const client = getSupabaseBrowserClient();
  if (!client) return null;

  const channel = client
    .channel("visit_logs_realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "visit_logs" }, callback)
    .subscribe();

  return () => { void client.removeChannel(channel); };
}

// ── Internal helpers ──────────────────────────────

async function fetchProfileByUserId(userId: string, fallbackEmail: string): Promise<Profile> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("מצב דמו בלבד.");

  const { data, error } = await client
    .from("profiles")
    .select("user_id, email, full_name, role")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("לא נמצא פרופיל למשתמש המחובר.");

  const p = data as ProfileRow;
  return { userId: p.user_id, email: p.email || fallbackEmail, fullName: p.full_name, role: p.role };
}

async function fetchLogs(profile: Profile, filters: DashboardFilters): Promise<VisitLog[]> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    const demoLogs = profile.role === "admin"
      ? getMockLogs()
      : getMockLogs().filter((l) => l.mashgiachName === profile.fullName);
    return filterLogs(demoLogs, filters);
  }

  let query = client
    .from("visit_logs")
    .select("id, occurred_at, occurred_date, occurred_time, mashgiach_display_name, location_display_name, city, status, message")
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (profile.role === "mashgiach") query = query.eq("mashgiach_user_id", profile.userId);
  if (filters.from) query = query.gte("occurred_date", filters.from);
  if (filters.to) query = query.lte("occurred_date", filters.to);
  if (profile.role === "admin" && filters.mashgiachNames.length > 0) query = query.in("mashgiach_display_name", filters.mashgiachNames);
  if (profile.role === "admin" && filters.locationNames.length > 0) query = query.in("location_display_name", filters.locationNames);
  if (profile.role === "admin" && filters.cities.length > 0) query = query.in("city", filters.cities);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as VisitLogRow[]).map(mapVisitLogRow);
}

function mapLocation(row: LocationRow): Location {
  return { id: row.id, name: row.name, city: row.city, qrCode: row.qr_code, isActive: row.is_active, createdAt: row.created_at, latitude: row.latitude, longitude: row.longitude };
}

function mapVisitLogRow(row: VisitLogRow): VisitLog {
  return { id: row.id, occurredAt: row.occurred_at, occurredDate: row.occurred_date, occurredTime: row.occurred_time, mashgiachName: row.mashgiach_display_name, locationName: row.location_display_name, city: row.city, status: row.status, message: row.message };
}

function summarizeByLocation(logs: VisitLog[]) {
  const map = new Map<string, { locationName: string; city: string; count: number }>();
  for (const log of logs) {
    const key = `${log.locationName ?? "לא זוהה"}-${log.city ?? "-"}`;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { locationName: log.locationName ?? "לא זוהה", city: log.city ?? "-", count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function latestVisitByLocation(logs: VisitLog[]) {
  const map = new Map<string, { locationName: string; city: string; mashgiachName: string; lastVisitAt: string }>();
  for (const log of logs) {
    const key = `${log.locationName ?? "לא זוהה"}-${log.city ?? "-"}`;
    const cur = map.get(key);
    if (!cur || cur.lastVisitAt < log.occurredAt) {
      map.set(key, { locationName: log.locationName ?? "לא זוהה", city: log.city ?? "-", mashgiachName: log.mashgiachName, lastVisitAt: log.occurredAt });
    }
  }
  return [...map.values()].sort((a, b) => (a.lastVisitAt < b.lastVisitAt ? 1 : -1));
}
