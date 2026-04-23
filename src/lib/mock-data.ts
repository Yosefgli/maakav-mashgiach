import type { Profile, Role, ScanResult, VisitLog } from "./types";
import { getDateParts } from "./utils";

const now = Date.now();

const mockProfiles: Record<Role, Profile> = {
  mashgiach: {
    userId: "demo-m-1",
    email: "mashgiach@example.com",
    fullName: "יוסף כהן",
    role: "mashgiach",
  },
  admin: {
    userId: "demo-a-1",
    email: "admin@example.com",
    fullName: "רחל לוי",
    role: "admin",
  },
};

const allowedLocationIds = ["loc-1", "loc-2"];

const locations = [
  { id: "loc-1", qrCode: "LOC-1001-XYZ", name: "מאפיית הצפון", city: "חיפה" },
  { id: "loc-2", qrCode: "LOC-2001-XYZ", name: "מפעל הגליל", city: "עכו" },
  { id: "loc-3", qrCode: "LOC-3001-XYZ", name: "יקב הכרם", city: "צפת" },
];

let mockLogs: VisitLog[] = [
  createLog({
    id: "log-1",
    hoursAgo: 2,
    mashgiachName: "יוסף כהן",
    locationName: "מאפיית הצפון",
    city: "חיפה",
    status: "success",
    message: "הכניסה נרשמה בהצלחה.",
  }),
  createLog({
    id: "log-2",
    hoursAgo: 8,
    mashgiachName: "יוסף כהן",
    locationName: "יקב הכרם",
    city: "צפת",
    status: "unauthorized",
    message: "אין הרשאה למקום זה.",
  }),
  createLog({
    id: "log-3",
    hoursAgo: 16,
    mashgiachName: "דוד חדד",
    locationName: "מפעל הגליל",
    city: "עכו",
    status: "success",
    message: "הכניסה נרשמה בהצלחה.",
  }),
  createLog({
    id: "log-4",
    hoursAgo: 30,
    mashgiachName: "דוד חדד",
    locationName: "מאפיית הצפון",
    city: "חיפה",
    status: "invalid_location",
    message: "הקוד שנסרק אינו משויך למקום פעיל.",
  }),
  createLog({
    id: "log-5",
    hoursAgo: 55,
    mashgiachName: "יוסף כהן",
    locationName: "מפעל הגליל",
    city: "עכו",
    status: "success",
    message: "הכניסה נרשמה בהצלחה.",
  }),
];

function createLog({
  city,
  hoursAgo,
  id,
  locationName,
  mashgiachName,
  message,
  status,
}: {
  id: string;
  hoursAgo: number;
  mashgiachName: string;
  locationName: string | null;
  city: string | null;
  status: VisitLog["status"];
  message: string;
}) {
  const occurredAt = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
  const parts = getDateParts(occurredAt);
  return {
    id,
    occurredAt,
    occurredDate: parts.occurredDate,
    occurredTime: parts.occurredTime,
    mashgiachName,
    locationName,
    city,
    status,
    message,
  };
}

export function getMockProfile(role: Role) {
  return mockProfiles[role];
}

export function getMockLogs() {
  return [...mockLogs].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}

export function getMockAllowedLocationsCount() {
  return allowedLocationIds.length;
}

export function runMockScan(profile: Profile, qrCode: string): ScanResult {
  const location = locations.find(
    (item) => item.qrCode.toLowerCase() === qrCode.toLowerCase(),
  );

  if (!location) {
    appendMockLog({
      mashgiachName: profile.fullName,
      locationName: null,
      city: null,
      status: "invalid_location",
      message: "הקוד שנסרק אינו מוכר במערכת.",
    });

    return {
      status: "invalid_location",
      message: "הקוד שנסרק אינו מוכר במערכת.",
    };
  }

  if (!allowedLocationIds.includes(location.id)) {
    appendMockLog({
      mashgiachName: profile.fullName,
      locationName: location.name,
      city: location.city,
      status: "unauthorized",
      message: "אין לך הרשאה לבצע כניסה למקום זה.",
    });

    return {
      status: "unauthorized",
      message: "אין לך הרשאה לבצע כניסה למקום זה.",
    };
  }

  appendMockLog({
    mashgiachName: profile.fullName,
    locationName: location.name,
    city: location.city,
    status: "success",
    message: "הכניסה בוצעה בהצלחה ונרשמה בלוג.",
  });

  return {
    status: "success",
    message: `הכניסה ל-${location.name} נרשמה בהצלחה.`,
  };
}

function appendMockLog({
  city,
  locationName,
  mashgiachName,
  message,
  status,
}: {
  city: string | null;
  locationName: string | null;
  mashgiachName: string;
  message: string;
  status: VisitLog["status"];
}) {
  const occurredAt = new Date().toISOString();
  const parts = getDateParts(occurredAt);
  mockLogs = [
    {
      id: `log-${mockLogs.length + 1}`,
      occurredAt,
      occurredDate: parts.occurredDate,
      occurredTime: parts.occurredTime,
      mashgiachName,
      locationName,
      city,
      status,
      message,
    },
    ...mockLogs,
  ];
}
