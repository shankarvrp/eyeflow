import { createFileRoute } from "@tanstack/react-router";
import { getAccessibleDepartments, isAdminRole } from "../../../features/auth/auth.server";
import {
  createExcelExport,
  createPdfExport,
} from "../../../features/revenue/collection-export.server";
import {
  dashboardQuerySchema,
  validateDashboardRange,
} from "../../../features/revenue/collection-query";
import { readCollectionExportRows } from "../../../features/revenue/revenue.server";
import { auth } from "../../../lib/auth.server";

export const Route = createFileRoute("/api/exports/collections")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return new Response("Authentication required.", { status: 401 });

        const url = new URL(request.url);
        const format = url.searchParams.get("format");
        if (format !== "xlsx" && format !== "pdf") {
          return new Response("Choose xlsx or pdf.", { status: 400 });
        }

        const parsed = dashboardQuerySchema.safeParse({
          collectionPage: 1,
          from: url.searchParams.get("from"),
          pageSize: 10,
          patientPage: 1,
          to: url.searchParams.get("to"),
        });
        if (!parsed.success) return new Response("Invalid export date range.", { status: 400 });

        const isAdmin = isAdminRole(session.user.role);
        const permission = await auth.api.userHasPermission({
          body: {
            permissions: { dashboard: ["export"] },
            role: isAdmin ? "admin" : "user",
          },
        });
        if (!permission.success) return new Response("Export is not permitted.", { status: 403 });
        const query = validateDashboardRange(parsed.data, isAdmin);
        const accessibleDepartments = await getAccessibleDepartments(
          session.user.id,
          session.user.role,
        );
        const rows = await readCollectionExportRows(accessibleDepartments, query);
        const bytes =
          format === "xlsx"
            ? await createExcelExport(rows, query.from, query.to)
            : await createPdfExport(rows, query.from, query.to);
        const body = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        const filename = `eyeflow-collections-${query.from}-to-${query.to}.${format}`;
        return new Response(body, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Type":
              format === "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/pdf",
          },
        });
      },
    },
  },
});
