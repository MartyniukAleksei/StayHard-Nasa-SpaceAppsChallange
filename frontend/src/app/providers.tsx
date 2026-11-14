import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Дані FLEX статичні — кешуємо надовго.
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: 1 } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
