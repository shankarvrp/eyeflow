import { z } from "zod";
import { isoDateSchema } from "../revenue/collection-query";

export const reportQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((value) => value.from <= value.to, {
    message: "From date must not be after to date",
    path: ["to"],
  })
  .refine(
    (value) =>
      (new Date(`${value.to}T12:00:00Z`).getTime() -
        new Date(`${value.from}T12:00:00Z`).getTime()) /
        86_400_000 <=
      366,
    { message: "Reports support a maximum range of 366 days", path: ["to"] },
  );

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export function currentMonthReportQuery(date = new Date()): ReportQuery {
  const today = clinicDateKey(date);
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function currentDayReportQuery(date = new Date()): ReportQuery {
  const today = clinicDateKey(date);
  return { from: today, to: today };
}

function clinicDateKey(date: Date) {
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
