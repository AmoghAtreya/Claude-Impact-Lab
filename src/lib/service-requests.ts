import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/trades";

export type IntakeStatus = "draft" | "shared" | "in_progress" | "submitted";
export type ReviewStatus = "unreviewed" | "reviewed" | "archived";

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  draft: "Link not shared yet",
  shared: "Link shared",
  in_progress: "Intake in progress",
  submitted: "Submitted",
};

export function requestReference(number: number) {
  return `#${number}`;
}

export type ServiceRequestSummary = {
  id: string;
  number: number;
  customerName: string;
  serviceAddress: string | null;
  intakeStatus: IntakeStatus;
  createdAt: string;
};

export type ServiceRequest = ServiceRequestSummary & {
  customerPhone: string | null;
  customerEmail: string | null;
  trade: Trade;
  tradeOther: string | null;
  issueDescription: string | null;
  customerDescription: string | null;
  limitedVisualInfo: boolean;
  activeLink: { id: string; expiresAt: string; expired: boolean } | null;
};

type RequestRow = {
  id: string;
  number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  service_address: string | null;
  trade: Trade;
  trade_other: string | null;
  issue_description: string | null;
  customer_description: string | null;
  limited_visual_info: boolean;
  intake_status: IntakeStatus;
  created_at: string;
  intake_links: { id: string; expires_at: string; revoked_at: string | null }[];
};

// Callers must pass the organization from requireWorkspace(); RLS also
// restricts rows to the user's workspaces.
export async function listServiceRequests(
  organizationId: string,
): Promise<ServiceRequestSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("id, number, customer_name, service_address, intake_status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<Omit<RequestRow, "intake_links">[], { merge: false }>();

  if (error) {
    throw new Error(`Failed to load requests: ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    number: row.number,
    customerName: row.customer_name,
    serviceAddress: row.service_address,
    intakeStatus: row.intake_status,
    createdAt: row.created_at,
  }));
}

export async function getServiceRequest(
  organizationId: string,
  requestId: string,
): Promise<ServiceRequest | null> {
  // Avoid a database error for malformed ids in the URL.
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "id, number, customer_name, customer_phone, customer_email, service_address, trade, trade_other, issue_description, customer_description, limited_visual_info, intake_status, created_at, intake_links (id, expires_at, revoked_at)",
    )
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle<RequestRow>();

  if (error) {
    throw new Error(`Failed to load request: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const active = data.intake_links.find((link) => link.revoked_at === null);
  return {
    id: data.id,
    number: data.number,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerEmail: data.customer_email,
    serviceAddress: data.service_address,
    trade: data.trade,
    tradeOther: data.trade_other,
    issueDescription: data.issue_description,
    customerDescription: data.customer_description,
    limitedVisualInfo: data.limited_visual_info,
    intakeStatus: data.intake_status,
    createdAt: data.created_at,
    activeLink: active
      ? {
          id: active.id,
          expiresAt: active.expires_at,
          expired: new Date(active.expires_at).getTime() <= Date.now(),
        }
      : null,
  };
}
