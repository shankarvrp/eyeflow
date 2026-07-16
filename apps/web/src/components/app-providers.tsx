import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

interface AppProvidersProps {
  children: ReactNode;
  queryClient: import("@tanstack/react-query").QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
