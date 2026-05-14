import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface BankEntry {
  id: string;
  name: string;
}

type BankMap = Map<string, string>;

async function fetchRegistry(): Promise<BankMap> {
  const resp = await fetch("/plewibnra.json");
  if (!resp.ok) throw new Error("Failed to load bank registry");
  const data: BankEntry[] = await resp.json();
  return new Map(data.map((b) => [b.id, b.name]));
}

/**
 * Returns a getBankName(nrb) lookup function.
 * The registry is fetched once and cached for the lifetime of the session.
 *
 * NRB layout: 2 check digits + 8 routing digits + 16 account digits.
 * The routing prefix identifies the bank: 3 digits = bank, 4 = cooperative
 * bank, 5 = payment service provider. Longest match wins.
 */
export function useBankRegistry(): (nrb: string) => string | undefined {
  const { data: registry } = useQuery<BankMap>({
    queryKey: ["bankRegistry"],
    queryFn: fetchRegistry,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return useCallback(
    (nrb: string): string | undefined => {
      if (!registry || nrb.length < 10) return undefined;
      const routing = nrb.slice(2, 10);
      return (
        registry.get(routing.slice(0, 5)) ??
        registry.get(routing.slice(0, 4)) ??
        registry.get(routing.slice(0, 3))
      );
    },
    [registry]
  );
}
