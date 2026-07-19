import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminRole, requireRevenuePermission } from "../auth/auth.server";
import { isoDateSchema } from "../revenue/collection-query";
import { importEmrAppointments, readEmrPatientOptions, readEmrSyncStatus } from "./emr.server";
import {
  connectEmrBrowser,
  hasConnectedEmrSession,
  scrapeEmrAppointments,
} from "./emr-browser.server";

const emrPatientQuerySchema = z.object({ appointmentDate: isoDateSchema });

export const getEmrPatientOptions = createServerFn({ method: "GET" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    await requireRevenuePermission("read");
    return readEmrPatientOptions(data.appointmentDate);
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
    const records = await scrapeEmrAppointments(data.appointmentDate);
    await importEmrAppointments(records, session.user.id, data.appointmentDate);
    return readEmrSyncStatus(data.appointmentDate, true);
  });

export const syncEmrNow = createServerFn({ method: "POST" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    const records = await scrapeEmrAppointments(data.appointmentDate);
    await importEmrAppointments(records, session.user.id, data.appointmentDate);
    return readEmrSyncStatus(data.appointmentDate, true);
  });
