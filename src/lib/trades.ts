// Must match the trade check constraint on public.organizations.
export const TRADES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
] as const;

export type Trade = (typeof TRADES)[number]["value"];
