import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRole, requireRevenuePermission } from "../auth/auth.server";
import { isoDateSchema } from "../revenue/collection-query";
import {
  importEmrAppointments,
  importEmrReceipts,
  readEmrPatientOptions,
  readEmrReceiptDrafts,
  readEmrSyncStatus,
} from "./emr.server";
import {
  connectEmrBrowser,
  hasConnectedEmrSession,
  scrapeEmrAppointments,
  scrapeEmrReceipts,
} from "./emr-browser.server";

const emrPatientQuerySchema = z.object({ appointmentDate: isoDateSchema });

export const getEmrPatientOptions = createServerFn({ method: "GET" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    await requireRevenuePermission("read");
    return readEmrPatientOptions(data.appointmentDate);
  });

const emrReceiptDraftQuerySchema = emrPatientQuerySchema.extend({
  emrPatientId: z.string().uuid(),
});

export const getEmrReceiptDrafts = createServerFn({ method: "GET" })
  .validator(emrReceiptDraftQuerySchema)
  .handler(async ({ data }) => {
    await requireRevenuePermission("read");
    return readEmrReceiptDrafts(data.appointmentDate, data.emrPatientId);
  });

export const getEmrSyncStatus = createServerFn({ method: "GET" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    await requireRevenuePermission("read");
    return readEmrSyncStatus(data.appointmentDate, await hasConnectedEmrSession());
  });

export const connectEmr = createServerFn({ method: "POST" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    if (!isAdminRole(session.user.role)) {
      throw new Response("Only administrators can connect the EMR.", { status: 403 });
    }

    await connectEmrBrowser();
    const receipts = await scrapeEmrReceipts(data.appointmentDate);
    await importEmrReceipts(receipts, session.user.id, data.appointmentDate);
    const records = await scrapeEmrAppointments(data.appointmentDate);
    await importEmrAppointments(records, session.user.id, data.appointmentDate);
    return readEmrSyncStatus(data.appointmentDate, true);
  });

export const syncEmrNow = createServerFn({ method: "POST" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    const receipts = await scrapeEmrReceipts(data.appointmentDate);
    await importEmrReceipts(receipts, session.user.id, data.appointmentDate);
    const records = await scrapeEmrAppointments(data.appointmentDate);
    await importEmrAppointments(records, session.user.id, data.appointmentDate);
    return readEmrSyncStatus(data.appointmentDate, true);
  });
