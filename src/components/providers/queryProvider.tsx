"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

import { getQueryClient } from "@/queries/queryClient";

export default function QueryProvider({ children }: { children: ReactNode }) {
  // Not useState: if React suspends during the first render it would throw the client away and make a new one.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Renders nothing in production builds. */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
