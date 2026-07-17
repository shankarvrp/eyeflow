import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid date");

export const dashboardQuerySchema = z.object({
  collectionPage: z.number().int().positive().default(1),
  from: isoDateSchema,
  pageSize: z.number().int().min(5).max(50).default(10),
  patientPage: z.number().int().positive().default(1),
  to: isoDateSchema,
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export function defaultDashboardQuery(): DashboardQuery {
  const today = clinicDateKey(new Date());
  return { collectionPage: 1, from: today, pageSize: 10, patientPage: 1, to: today };
}

export function validateDashboardRange(query: DashboardQuery, isAdmin: boolean): DashboardQuery {
  const parsed = dashboardQuerySchema.parse(query);
  const from = parseDateKey(parsed.from);
  const to = parseDateKey(parsed.to);
  if (from > to) throw new Response("The start date must be before the end date.", { status: 400 });

  const todayKey = clinicDateKey(new Date());
  if (parsed.to > todayKey) {
    throw new Response("Future collection dates are not available.", { status: 400 });
  }

  const dayCount = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (isAdmin) {
    if (dayCount > 731) {
      throw new Response("Administrator ranges are limited to two years.", { status: 400 });
    }
  } else {
    const currentMonth = todayKey.slice(0, 7);
    if (!parsed.from.startsWith(currentMonth) || !parsed.to.startsWith(currentMonth)) {
      throw new Response("Users may view dates only within the current month.", { status: 403 });
    }
    if (dayCount > 31) {
      throw new Response("User ranges are limited to the current month.", { status: 400 });
    }
  }

  return parsed;
}

export function validateCollectionDate(occurredOn: string, isAdmin: boolean): void {
  const today = clinicDateKey(new Date());
  if (occurredOn > today) {
    throw new Response("Collections cannot be entered for a future date.", { status: 400 });
  }
  if (!isAdmin && occurredOn !== today) {
    throw new Response("Users may enter collections only for today.", { status: 403 });
  }
}

export function clinicDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function clinicDateBounds(from: string, to: string): { end: Date; start: Date } {
  const nextDay = parseDateKey(to);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    end: new Date(`${toDateKey(nextDay)}T00:00:00+05:30`),
    start: new Date(`${from}T00:00:00+05:30`),
  };
}

export function collectionTimestamp(occurredOn: string): Date {
  const today = clinicDateKey(new Date());
  return occurredOn === today ? new Date() : new Date(`${occurredOn}T12:00:00+05:30`);
}

export function shiftDateKey(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
