import { createFileRoute } from "@tanstack/react-router";
import { isAdminRole } from "../../../features/auth/auth.server";
import { importEmrAppointments } from "../../../features/emr/emr.server";
import { emrAppointmentImportBatchSchema } from "../../../features/emr/emr-schema";
import { auth } from "../../../lib/auth.server";

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { response: new Response("Authentication required.", { status: 401 }) };
  if (!isAdminRole(session.user.role)) {
    return { response: new Response("Administrator access is required.", { status: 403 }) };
  }
  return { session };
}

export const Route = createFileRoute("/api/emr/import")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = await requireAdmin(request);
        if ("response" in authorization) return authorization.response;
        return new Response(importForm(), {
          headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      },
      POST: async ({ request }) => {
        const authorization = await requireAdmin(request);
        if ("response" in authorization) return authorization.response;
        const origin = request.headers.get("Origin");
        if (origin && origin !== new URL(request.url).origin) {
          return new Response("Cross-origin import rejected.", { status: 403 });
        }

        const form = await request.formData();
        const payload = form.get("payload");
        if (typeof payload !== "string") {
          return new Response("Import payload is required.", { status: 400 });
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(payload);
        } catch {
          return new Response("Import payload must be valid JSON.", { status: 400 });
        }
        const parsed = emrAppointmentImportBatchSchema.safeParse(decoded);
        if (!parsed.success) return new Response("Import payload is invalid.", { status: 400 });

        const imported = await importEmrAppointments(parsed.data, authorization.session.user.id);
        return new Response(successPage(imported), {
          headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      },
    },
  },
});

function importForm(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>EyeFlow EMR import</title><style>${styles}</style></head><body><main><h1>EMR patient import</h1><p>Administrator-only local fallback for an authorized browser extraction.</p><form method="post"><label for="payload">Validated appointment JSON</label><textarea id="payload" name="payload" required></textarea><button type="submit">Import patients</button></form></main></body></html>`;
}

function successPage(imported: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>EMR import complete</title><style>${styles}</style></head><body><main><h1>Import complete</h1><p>${imported} patient appointments synchronized.</p><a href="/">Return to EyeFlow</a></main></body></html>`;
}

const styles = `body{font-family:ui-sans-serif,system-ui;background:#f8fafc;color:#0f172a;margin:0}main{max-width:760px;margin:64px auto;background:white;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 20px 50px #0f172a12}p{color:#475569}label{display:block;font-weight:700;margin:24px 0 8px}textarea{box-sizing:border-box;width:100%;min-height:260px;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:13px ui-monospace,monospace}button,a{display:inline-block;margin-top:16px;border:0;border-radius:10px;background:#059669;color:white;padding:11px 16px;font-weight:700;text-decoration:none;cursor:pointer}`;
