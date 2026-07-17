import { createFileRoute } from "@tanstack/react-router";
import { isAdminRole } from "../../../features/auth/auth.server";
import { subscribeToCollectionChanges } from "../../../features/revenue/collection-events.server";
import { auth } from "../../../lib/auth.server";

const encoder = new TextEncoder();

export const Route = createFileRoute("/api/live/collections")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return new Response("Authentication required.", { status: 401 });
        if (!isAdminRole(session.user.role)) {
          return new Response("Live collection monitoring is restricted to administrators.", {
            status: 403,
          });
        }

        let cleanup = () => undefined;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            const send = (payload: string) => {
              if (!closed) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            };
            const unsubscribe = subscribeToCollectionChanges(send);
            const heartbeat = setInterval(() => {
              if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
            }, 15_000);

            cleanup = () => {
              if (closed) return;
              closed = true;
              clearInterval(heartbeat);
              unsubscribe();
            };

            request.signal.addEventListener("abort", cleanup, { once: true });
            send(JSON.stringify({ connectedAt: new Date().toISOString() }));
          },
          cancel() {
            cleanup();
          },
        });

        return new Response(stream, {
          headers: {
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
