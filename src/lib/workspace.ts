import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/trades";

export type WorkspaceRole = "owner" | "admin" | "member" | "technician";

export type Workspace = {
  id: string;
  name: string;
  trade: Trade;
  tradeOther: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  timezone: string;
  role: WorkspaceRole;
};

type MembershipRow = {
  role: WorkspaceRole;
  organizations: {
    id: string;
    name: string;
    trade: Trade;
    trade_other: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    timezone: string;
  } | null;
};

// The signed-in user's workspace, or null if they haven't finished
// onboarding. RLS limits the query to the user's own memberships.
export const getCurrentWorkspace = cache(
  async (): Promise<{ user: CurrentUser; workspace: Workspace | null }> => {
    const user = await getCurrentUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select(
        "role, organizations (id, name, trade, trade_other, contact_email, contact_phone, timezone)",
      )
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle<MembershipRow>();

    if (error) {
      throw new Error(`Failed to load workspace: ${error.message}`);
    }

    const org = data?.organizations;
    if (!data || !org) {
      return { user, workspace: null };
    }

    return {
      user,
      workspace: {
        id: org.id,
        name: org.name,
        trade: org.trade,
        tradeOther: org.trade_other,
        contactEmail: org.contact_email,
        contactPhone: org.contact_phone,
        timezone: org.timezone,
        role: data.role,
      },
    };
  },
);

// Use in every portal page and server operation. Signed-out users go to
// /login; signed-in users without a workspace go to /onboarding.
export async function requireWorkspace(): Promise<{
  user: CurrentUser;
  workspace: Workspace;
}> {
  const { user, workspace } = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/onboarding");
  }
  return { user, workspace };
}
