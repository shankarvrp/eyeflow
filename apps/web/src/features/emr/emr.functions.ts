import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireRevenuePermission } from "../auth/auth.server";
import { isoDateSchema } from "../revenue/collection-query";
import { readEmrPatientOptions } from "./emr.server";

const emrPatientQuerySchema = z.object({ appointmentDate: isoDateSchema });

export const getEmrPatientOptions = createServerFn({ method: "GET" })
  .validator(emrPatientQuerySchema)
  .handler(async ({ data }) => {
    await requireRevenuePermission("read");
    return readEmrPatientOptions(data.appointmentDate);
  });
