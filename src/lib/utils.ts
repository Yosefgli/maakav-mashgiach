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
    mashgiachName?: string;
    locationName?: string;
    city?: string;
  },
) {
  return logs.filter((log) => {
    if (filters.from && log.occurredDate < filters.from) {
      return false;
    }

    if (filters.to && log.occurredDate > filters.to) {
      return false;
    }

    if (
      filters.mashgiachName &&
      !log.mashgiachName.toLowerCase().includes(filters.mashgiachName.toLowerCase())
    ) {
      return false;
    }

    if (
      filters.locationName &&
      !(log.locationName ?? "").toLowerCase().includes(filters.locationName.toLowerCase())
    ) {
      return false;
    }

    if (filters.city && !(log.city ?? "").toLowerCase().includes(filters.city.toLowerCase())) {
      return false;
    }

    return true;
  });
}

export function getDateParts(iso: string) {
  const date = new Date(iso);
  return {
    occurredDate: date.toISOString().slice(0, 10),
    occurredTime: date.toISOString().slice(11, 19),
  };
}
