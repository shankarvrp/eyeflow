import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface EmrReceiptImport {
  amount: number;
  externalLineKey: string;
  externalPatientId: string;
  externalReceiptId: string;
  occurredAt: Date;
  patientName: string;
  paymentMode: string;
  receiptDate: string;
  receiptType: string;
  remarks: string;
  sourceDepartment: string;
}

interface PositionedText {
  str: string;
  x: number;
  y: number;
}

interface PendingReceipt {
  amount: number;
  externalReceiptId: string;
  patientName: string;
  paymentMode: string;
  receiptType: string;
  remarks: string;
  sourceDepartment: string;
  time: string;
}

export async function parseEmrReceiptPdf(
  bytes: Uint8Array,
  receiptDate: string,
): Promise<EmrReceiptImport[]> {
  const document = await getDocument({ data: bytes, isEvalSupported: false, useWorkerFetch: false })
    .promise;
  const receipts: EmrReceiptImport[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedText[] = content.items.flatMap((item) =>
      "str" in item && item.str.trim()
        ? [{ str: item.str.trim(), x: item.transform[4], y: item.transform[5] }]
        : [],
    );
    receipts.push(...parseReceiptPage(items, receiptDate));
  }

  return receipts;
}

export function parseReceiptPage(items: PositionedText[], receiptDate: string): EmrReceiptImport[] {
  const lines = groupByLine(items);
  const receipts: EmrReceiptImport[] = [];
  let pending: PendingReceipt | null = null;

  for (const line of lines) {
    const externalPatientId = line
      .map((item) => item.str)
      .find((value) => /^MIR-PAT-\d+$/i.test(value));
    if (externalPatientId && pending) {
      const occurredAt = parseClinicTimestamp(receiptDate, pending.time);
      const externalLineKey = createHash("sha256")
        .update(
          [
            pending.externalReceiptId,
            externalPatientId,
            pending.sourceDepartment,
            pending.amount.toFixed(2),
            occurredAt.toISOString(),
          ].join("|"),
        )
        .digest("hex");
      receipts.push({
        ...pending,
        externalLineKey,
        externalPatientId,
        occurredAt,
        receiptDate,
      });
      pending = null;
      continue;
    }

    const byColumn = columnValues(line);
    if (!/^\d+$/.test(byColumn.serial) || !/^MIR-[A-Z]+-\d+(?:-\d+)?$/i.test(byColumn.receiptId)) {
      continue;
    }
    const amount = Number(byColumn.amount.replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    pending = {
      amount,
      externalReceiptId: byColumn.receiptId,
      patientName: byColumn.patient,
      paymentMode: byColumn.paymentMode,
      receiptType: byColumn.type,
      remarks: byColumn.remarks === "-" ? "" : byColumn.remarks,
      sourceDepartment: byColumn.department,
      time: byColumn.time,
    };
  }

  return receipts;
}

function groupByLine(items: PositionedText[]): PositionedText[][] {
  const groups = new Map<number, PositionedText[]>();
  for (const item of items) {
    const y = Math.round(item.y);
    const group = groups.get(y) ?? [];
    group.push(item);
    groups.set(y, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right - left)
    .map(([, line]) => line.sort((left, right) => left.x - right.x));
}

function columnValues(line: PositionedText[]) {
  const read = (minimum: number, maximum: number) =>
    line
      .filter((item) => item.x >= minimum && item.x < maximum)
      .map((item) => item.str)
      .join(" ")
      .trim();
  return {
    amount: read(770, Number.POSITIVE_INFINITY),
    department: read(695, 770),
    patient: read(190, 310),
    paymentMode: read(510, 605),
    receiptId: read(420, 510),
    remarks: read(605, 695),
    serial: read(0, 55),
    time: read(55, 120),
    type: read(120, 190),
  };
}

function parseClinicTimestamp(receiptDate: string, time: string): Date {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(time.trim());
  if (!match) return new Date(`${receiptDate}T12:00:00+05:30`);
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toLocaleLowerCase("en-IN");
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return new Date(`${receiptDate}T${String(hour).padStart(2, "0")}:${minute}:00+05:30`);
}
