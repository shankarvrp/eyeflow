import { createDatabase } from "@eyeflow/db";
import { auditEvents, collectionSignoffs, dailyClosures } from "@eyeflow/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { readDashboardData } from "../revenue/revenue.server";
import type { SignOffCollection } from "./closure-schema";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for daily closure.");
  database ??= createDatabase(databaseUrl);
  return database;
}

export async function assertCollectionDatesOpen(businessDates: string[]): Promise<void> {
  if (businessDates.length === 0) return;
  const rows = await getDatabase()
    .select({ businessDate: dailyClosures.businessDate })
    .from(dailyClosures)
    .where(
      and(
        inArray(dailyClosures.businessDate, [...new Set(businessDates)]),
        eq(dailyClosures.status, "closed"),
      ),
    );
  if (rows.length > 0) {
    throw new Response(
      `Collections are locked for ${rows.map((row) => row.businessDate).join(", ")}. Reopen the day before editing.`,
      { status: 409 },
    );
  }
}

export async function closeBusinessDay(businessDate: string, reason: string, actorUserId: string) {
  const db = getDatabase();
  const dashboard = await readDashboardData(null, true, {
    collectionPage: 1,
    from: businessDate,
    pageSize: 10,
    patientPage: 1,
    to: businessDate,
  });
  const completedSignoffs = dashboard.signoffs?.periods ?? [];
  const capturedTotal = completedSignoffs.reduce(
    (total, signoff) => total + signoff.calculatedNet,
    0,
  );
  if (
    completedSignoffs.length !== 2 ||
    Math.abs(dashboard.signoffs?.variance ?? Number.POSITIVE_INFINITY) >= 0.01 ||
    Math.abs(capturedTotal - dashboard.summary.revenue) >= 0.01
  ) {
    throw new Response(
      "Complete both collection sign-offs and match their declared and captured totals to the day before closing.",
      { status: 409 },
    );
  }

  await db.transaction(async (transaction) => {
    await transaction
      .insert(dailyClosures)
      .values({
        businessDate,
        closedByUserId: actorUserId,
        reason,
        snapshot: {
          reconciliation: dashboard.reconciliation,
          summary: dashboard.summary,
        },
        status: "closed",
      })
      .onConflictDoUpdate({
        target: dailyClosures.businessDate,
        set: {
          closedAt: new Date(),
          closedByUserId: actorUserId,
          reason,
          reopenedAt: null,
          reopenedByUserId: null,
          snapshot: {
            reconciliation: dashboard.reconciliation,
            summary: dashboard.summary,
          },
          status: "closed",
          updatedAt: new Date(),
        },
      });
    await transaction.insert(auditEvents).values({
      action: "revenue.day.closed",
      actorUserId,
      after: { businessDate, reason, summary: dashboard.summary },
      before: {},
      entityId: businessDate,
      entityType: "daily-closure",
      reason,
    });
  });
  return readDashboardData(null, true, {
    collectionPage: 1,
    from: businessDate,
    pageSize: 10,
    patientPage: 1,
    to: businessDate,
  });
}

export async function signOffCollectionPeriod(input: SignOffCollection, actorUserId: string) {
  const db = getDatabase();
  await assertCollectionDatesOpen([input.businessDate]);
  const dashboard = await readDashboardData(null, true, {
    collectionPage: 1,
    from: input.businessDate,
    pageSize: 10,
    patientPage: 1,
    to: input.businessDate,
  });
  const midday = dashboard.signoffs?.periods.find((period) => period.period === "midday");
  if (input.period === "endofday" && !midday) {
    throw new Response("Complete the mid-day sign-off before the later sign-off.", { status: 409 });
  }
  const calculatedNet =
    input.period === "midday"
      ? dashboard.summary.revenue
      : dashboard.summary.revenue - (midday?.calculatedNet ?? 0);
  const [before] = await db
    .select()
    .from(collectionSignoffs)
    .where(
      and(
        eq(collectionSignoffs.businessDate, input.businessDate),
        eq(collectionSignoffs.period, input.period),
      ),
    )
    .limit(1);

  await db.transaction(async (transaction) => {
    await transaction
      .insert(collectionSignoffs)
      .values({
        businessDate: input.businessDate,
        calculatedNet: calculatedNet.toFixed(2),
        declaredCash: input.declaredCash.toFixed(2),
        declaredCredit: input.declaredCredit.toFixed(2),
        declaredDiscount: input.declaredDiscount.toFixed(2),
        declaredOnline: input.declaredOnline.toFixed(2),
        note: input.note,
        period: input.period,
        signedByUserId: actorUserId,
      })
      .onConflictDoUpdate({
        target: [collectionSignoffs.businessDate, collectionSignoffs.period],
        set: {
          calculatedNet: calculatedNet.toFixed(2),
          declaredCash: input.declaredCash.toFixed(2),
          declaredCredit: input.declaredCredit.toFixed(2),
          declaredDiscount: input.declaredDiscount.toFixed(2),
          declaredOnline: input.declaredOnline.toFixed(2),
          note: input.note,
          signedAt: new Date(),
          signedByUserId: actorUserId,
          updatedAt: new Date(),
        },
      });
    await transaction.insert(auditEvents).values({
      action: `revenue.collection.${input.period}.signed-off`,
      actorUserId,
      after: { ...input, calculatedNet },
      before: before ?? {},
      entityId: `${input.businessDate}:${input.period}`,
      entityType: "collection-signoff",
      reason: input.note,
    });
  });
  return readDashboardData(null, true, {
    collectionPage: 1,
    from: input.businessDate,
    pageSize: 10,
    patientPage: 1,
    to: input.businessDate,
  });
}

export async function reopenBusinessDay(businessDate: string, reason: string, actorUserId: string) {
  const db = getDatabase();
  const [existing] = await db
    .select({ status: dailyClosures.status })
    .from(dailyClosures)
    .where(eq(dailyClosures.businessDate, businessDate))
    .limit(1);
  if (!existing || existing.status !== "closed") {
    throw new Response("This business day is not closed.", { status: 409 });
  }

  await db.transaction(async (transaction) => {
    await transaction
      .update(dailyClosures)
      .set({
        reason,
        reopenedAt: new Date(),
        reopenedByUserId: actorUserId,
        status: "open",
        updatedAt: new Date(),
      })
      .where(eq(dailyClosures.businessDate, businessDate));
    await transaction.insert(auditEvents).values({
      action: "revenue.day.reopened",
      actorUserId,
      after: { businessDate, reason, status: "open" },
      before: { status: "closed" },
      entityId: businessDate,
      entityType: "daily-closure",
      reason,
    });
  });
  return readDashboardData(null, true, {
    collectionPage: 1,
    from: businessDate,
    pageSize: 10,
    patientPage: 1,
    to: businessDate,
  });
}
