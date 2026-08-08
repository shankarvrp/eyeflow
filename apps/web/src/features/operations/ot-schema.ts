import { z } from "zod";
import { isoDateSchema } from "../revenue/collection-query";

export const otCaseStatuses = ["scheduled", "discharged_today"] as const;
export type OtCaseStatus = (typeof otCaseStatuses)[number];

export const otCaseStatusLabels: Record<OtCaseStatus, string> = {
  discharged_today: "Discharged today",
  scheduled: "Scheduled",
};

const amountSchema = z.number().min(0).max(100_000_000);

export const otScheduleQuerySchema = z.object({ businessDate: isoDateSchema });

export const updateOtPackageSchema = z.object({
  businessDate: isoDateSchema,
  caseId: z.string().uuid(),
  packageAmount: amountSchema,
});

export const signOffOtPackageSchema = z.object({
  businessDate: isoDateSchema,
  declaredAmount: amountSchema,
  note: z.string().trim().min(3).max(240),
});

export interface EmrOtCaseImport {
  businessDate: string;
  externalCaseId: string;
  externalPatientId: string;
  patientName: string;
  procedureName: string | null;
  scheduledAt: string | null;
  status: OtCaseStatus;
  surgeonName: string | null;
}

export interface OtPaymentLine {
  amount: number;
  kind: "cash" | "credit" | "online";
  occurredAt: string;
  providerOrMode: string | null;
}

export interface OtScheduleCase {
  businessDate: string;
  cashAmount: number;
  collectedAmount: number;
  creditAmount: number;
  externalPatientId: string;
  id: string;
  packageAmount: number | null;
  packageUpdatedAt: string | null;
  packageUpdatedBy: string | null;
  onlineAmount: number;
  patientName: string;
  payments: OtPaymentLine[];
  procedureName: string | null;
  scheduledAt: string | null;
  status: OtCaseStatus;
  surgeonName: string | null;
}

export interface OtPackageSignoff {
  calculatedAmount: number;
  declaredAmount: number;
  matches: boolean;
  note: string;
  signedAt: string;
  signedBy: string;
  signerRole: "admin" | "user";
}

export interface OtScheduleData {
  cases: OtScheduleCase[];
  signoffs: OtPackageSignoff[];
  summary: {
    cashAmount: number;
    collectedAmount: number;
    creditAmount: number;
    dischargedCount: number;
    onlineAmount: number;
    packageAmount: number;
    scheduledCount: number;
    variance: number;
  };
}
