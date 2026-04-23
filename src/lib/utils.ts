import type { VisitLog, VisitStatus } from "./types";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) {
    return "הרגע";
  }

  if (diffMinutes < 60) {
    return `לפני ${diffMinutes} דקות`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `לפני ${diffHours} שעות`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `לפני ${diffDays} ימים`;
}

export function getStatusTone(status: VisitStatus) {
  switch (status) {
    case "success":
      return "success";
    case "unauthorized":
    case "invalid_location":
      return "warning";
    case "error":
    default:
      return "danger";
  }
}

export function filterLogs<T extends VisitLog>(
  logs: T[],
  filters: {
    from?: string;
    to?: string;
    mashgiachNames?: string[];
    locationNames?: string[];
    cities?: string[];
  },
) {
  return logs.filter((log) => {
    if (filters.from && log.occurredDate < filters.from) return false;
    if (filters.to && log.occurredDate > filters.to) return false;
    if (filters.mashgiachNames?.length && !filters.mashgiachNames.includes(log.mashgiachName)) return false;
    if (filters.locationNames?.length && !filters.locationNames.includes(log.locationName ?? "")) return false;
    if (filters.cities?.length && !filters.cities.includes(log.city ?? "")) return false;
    return true;
  });
}

export function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDateParts(iso: string) {
  const date = new Date(iso);
  return {
    occurredDate: date.toISOString().slice(0, 10),
    occurredTime: date.toISOString().slice(11, 19),
  };
}
