export type Role = "mashgiach" | "admin";

export type VisitStatus = "success" | "unauthorized" | "invalid_location" | "error";

export type Profile = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
};

export type VisitLog = {
  id: string;
  occurredAt: string;
  occurredDate: string;
  occurredTime: string;
  mashgiachName: string;
  locationName: string | null;
  city: string | null;
  status: VisitStatus;
  message: string;
};

export type LocationSummary = {
  locationName: string;
  city: string;
  count: number;
};

export type LatestVisitSummary = {
  locationName: string;
  city: string;
  mashgiachName: string;
  lastVisitAt: string;
};

export type MashgiachDashboardData = {
  logs: VisitLog[];
  metrics: {
    successfulVisits: number;
    blockedVisits: number;
    allowedLocations: number;
    lastVisitLabel: string | null;
  };
};

export type AdminDashboardData = {
  logs: VisitLog[];
  metrics: {
    totalLogs: number;
    activeMashgichim: number;
    activeLocations: number;
    currentMonthVisits: number;
  };
  byLocation: LocationSummary[];
  weeklySummary: LocationSummary[];
  monthlySummary: LocationSummary[];
  latestByLocation: LatestVisitSummary[];
};

export type ScanResult = {
  status: VisitStatus;
  message: string;
};

export type LoginFormState = {
  email: string;
  password: string;
};
