import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppProviders } from "../components/app-providers";
import { queryClient } from "../lib/query-client";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: appCss }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "description",
        content: "EyeFlow — modern revenue operations for eye care teams.",
      },
      { title: "EyeFlow · Revenue dashboard" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AppProviders queryClient={queryClient}>{children}</AppProviders>
        <Scripts />
      </body>
    </html>
  );
}
