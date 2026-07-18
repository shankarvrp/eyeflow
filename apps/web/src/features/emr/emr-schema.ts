import { z } from "zod";
import { isoDateSchema } from "../revenue/collection-query";

export const emrAppointmentImportSchema = z.object({
  appointmentDate: isoDateSchema,
  externalAppointmentId: z.string().trim().min(1).max(120),
  externalPatientId: z.string().trim().min(1).max(120),
  patientName: z.string().trim().min(2).max(120),
  visitType: z.string().trim().max(80).nullable(),
});

export const emrAppointmentImportBatchSchema = z.array(emrAppointmentImportSchema).min(1).max(500);
