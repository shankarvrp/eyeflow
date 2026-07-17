import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { CollectionExportRow } from "./revenue.server";

export async function createExcelExport(
  rows: CollectionExportRow[],
  from: string,
  to: string,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EyeFlow";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Collections", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  worksheet.mergeCells("A1:I1");
  worksheet.getCell("A1").value = "EyeFlow Collection Report";
  worksheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  worksheet.getCell("A1").fill = {
    fgColor: { argb: "FF064E3B" },
    pattern: "solid",
    type: "pattern",
  };
  worksheet.getCell("A2").value = "Period";
  worksheet.getCell("B2").value = `${from} to ${to}`;
  worksheet.getCell("A3").value = "Generated";
  worksheet.getCell("B3").value = new Date();
  worksheet.getCell("B3").numFmt = "dd-mmm-yyyy hh:mm";

  worksheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Time", key: "time", width: 12 },
    { header: "Patient", key: "patient", width: 28 },
    { header: "Department", key: "department", width: 18 },
    { header: "Mode", key: "mode", width: 12 },
    { header: "Provider / Mode", key: "provider", width: 20 },
    { header: "Gross", key: "gross", width: 14 },
    { header: "Discount", key: "discount", width: 14 },
    { header: "Final", key: "final", width: 14 },
  ];

  const header = worksheet.getRow(4);
  header.values = [
    "Date",
    "Time",
    "Patient",
    "Department",
    "Mode",
    "Provider / Mode",
    "Gross",
    "Discount",
    "Final",
  ];
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { fgColor: { argb: "FF059669" }, pattern: "solid", type: "pattern" };

  for (const row of rows) {
    worksheet.addRow({
      date: row.occurredAt,
      department: row.department,
      discount: row.discount,
      final: row.amount - row.discount,
      gross: row.amount,
      mode: row.mode,
      patient: row.patient,
      provider: row.providerOrMode ?? "",
      time: row.occurredAt,
    });
  }

  for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    worksheet.getCell(`A${rowNumber}`).numFmt = "dd-mmm-yyyy";
    worksheet.getCell(`B${rowNumber}`).numFmt = "hh:mm AM/PM";
    for (const column of ["G", "H", "I"]) {
      worksheet.getCell(`${column}${rowNumber}`).numFmt = "₹#,##0.00";
    }
  }

  const totalRow = worksheet.addRow({
    department: "TOTAL",
    discount: rows.reduce((sum, row) => sum + row.discount, 0),
    final: rows.reduce((sum, row) => sum + row.amount - row.discount, 0),
    gross: rows.reduce((sum, row) => sum + row.amount, 0),
  });
  totalRow.font = { bold: true };
  totalRow.fill = { fgColor: { argb: "FFD1FAE5" }, pattern: "solid", type: "pattern" };
  for (const column of ["G", "H", "I"]) {
    worksheet.getCell(`${column}${totalRow.number}`).numFmt = "₹#,##0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function createPdfExport(
  rows: CollectionExportRow[],
  from: string,
  to: string,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [842, 595];
  const columns = [
    { label: "Date", width: 68 },
    { label: "Patient", width: 145 },
    { label: "Department", width: 90 },
    { label: "Mode", width: 65 },
    { label: "Provider", width: 100 },
    { label: "Gross", width: 70 },
    { label: "Discount", width: 70 },
    { label: "Final", width: 70 },
  ];
  const margin = 28;
  const rowHeight = 19;
  let page = document.addPage(pageSize);
  let y = 555;

  const drawHeader = () => {
    page.drawText("EyeFlow Collection Report", { font: bold, size: 18, x: margin, y });
    page.drawText(`${from} to ${to}  |  ${rows.length} payments`, {
      color: rgb(0.35, 0.4, 0.45),
      font: regular,
      size: 9,
      x: margin,
      y: y - 18,
    });
    y -= 44;
    page.drawRectangle({
      color: rgb(0.02, 0.59, 0.41),
      height: rowHeight,
      width: pageSize[0] - margin * 2,
      x: margin,
      y: y - 4,
    });
    let x = margin + 4;
    for (const column of columns) {
      page.drawText(column.label, { color: rgb(1, 1, 1), font: bold, size: 8, x, y });
      x += column.width;
    }
    y -= rowHeight;
  };

  drawHeader();
  for (const [index, row] of rows.entries()) {
    if (y < 45) {
      page = document.addPage(pageSize);
      y = 555;
      drawHeader();
    }
    if (index % 2 === 1) {
      page.drawRectangle({
        color: rgb(0.96, 0.98, 0.97),
        height: rowHeight,
        width: pageSize[0] - margin * 2,
        x: margin,
        y: y - 5,
      });
    }
    const values = [
      formatDate(row.occurredAt),
      truncate(row.patient, 24),
      truncate(row.department, 14),
      row.mode,
      truncate(row.providerOrMode ?? "-", 16),
      formatMoney(row.amount),
      formatMoney(row.discount),
      formatMoney(row.amount - row.discount),
    ];
    let x = margin + 4;
    for (const [columnIndex, value] of values.entries()) {
      page.drawText(value, { font: regular, size: 8, x, y });
      x += columns[columnIndex]?.width ?? 0;
    }
    y -= rowHeight;
  }

  if (y < 45) {
    page = document.addPage(pageSize);
    y = 555;
  }
  page.drawText(
    `Total: ${formatMoney(rows.reduce((sum, row) => sum + row.amount - row.discount, 0))}`,
    { font: bold, size: 11, x: 650, y: y - 5 },
  );
  return document.save();
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
    year: "2-digit",
  }).format(value);
}

function formatMoney(value: number): string {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
