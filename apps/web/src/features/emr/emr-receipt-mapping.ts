import type { DepartmentName, PaymentKind } from "@eyeflow/shared";

export interface ReceiptMappingInput {
  paymentMode: string;
  receiptType: string;
  remarks?: string;
  sourceDepartment: string;
}

export interface ReceiptMapping {
  department: DepartmentName | null;
  mode: PaymentKind;
  providerOrMode: string | null;
  requiresReview: boolean;
}

const departmentAliases: ReadonlyArray<[RegExp, DepartmentName]> = [
  [/\b(pharmacy|medicine)\b/i, "Pharmacy"],
  [/\b(investigation|laboratory|lab|diagnostic|scan)\b/i, "Investigation"],
  [/\b(optical|opticals|spectacle|glasses)\b/i, "Opticals"],
  [/\b(ot|operation theatre|surgery|ipd)\b/i, "OT"],
  [/\b(opd|consultation|reception)\b/i, "OPD"],
];

export function mapEmrReceipt(input: ReceiptMappingInput): ReceiptMapping {
  const isRefund = /refund/i.test(input.receiptType);
  const departmentText = `${input.sourceDepartment} ${input.receiptType} ${input.remarks ?? ""}`;
  const department = isRefund
    ? null
    : (departmentAliases.find(([pattern]) => pattern.test(departmentText))?.[1] ?? null);
  const normalizedMode = input.paymentMode.trim().toLocaleLowerCase("en-IN");
  const isCash = normalizedMode === "cash";
  const isCredit = /credit|insurance|cghs|echs|tpa/.test(normalizedMode);
  const mode: PaymentKind = isCash ? "cash" : isCredit ? "credit" : "online";

  return {
    department,
    mode,
    providerOrMode: isCash ? null : input.paymentMode.trim() || "Other",
    requiresReview: isRefund || department === null,
  };
}
