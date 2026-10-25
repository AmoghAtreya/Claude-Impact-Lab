"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { newIntakeLink } from "@/lib/intake-links";
import { createClient } from "@/lib/supabase/server";
import { TRADE_OTHER_MAX_LENGTH, TRADES, type Trade } from "@/lib/trades";
import { PHONE_PATTERN, PHONE_PATTERN_MESSAGE } from "@/lib/validation";
import { requireWorkspace } from "@/lib/workspace";

export type RequestField =
  | "customerName"
  | "customerPhone"
  | "customerEmail"
  | "serviceAddress"
  | "trade"
  | "tradeOther"
  | "issueDescription";

export type RequestFormState = {
  error?: string;
  fieldErrors?: Partial<Record<RequestField, string>>;
};

const tradeValues = TRADES.map((trade) => trade.value) as [Trade, ...Trade[]];

const requestSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(1, { error: "Enter the customer's name." })
      .max(120, { error: "Keep the name under 120 characters." }),
    customerPhone: z
      .string()
      .trim()
      .max(40, { error: "Enter a shorter phone number." })
      .regex(PHONE_PATTERN, { error: PHONE_PATTERN_MESSAGE }),
    customerEmail: z
      .string()
      .trim()
      .max(254)
      .refine((value) => value === "" || z.email().safeParse(value).success, {
        error: "Enter a valid email address, or leave it blank.",
      }),
    serviceAddress: z
      .string()
      .trim()
      .max(300, { error: "Keep the address under 300 characters." }),
    trade: z.enum(tradeValues, { error: "Choose a trade." }),
    tradeOther: z
      .string()
      .trim()
      .max(TRADE_OTHER_MAX_LENGTH, {
        error: `Keep the trade under ${TRADE_OTHER_MAX_LENGTH} characters.`,
      }),
    issueDescription: z
      .string()
      .trim()
      .max(2000, { error: "Keep the description under 2,000 characters." }),
  })
  .refine((data) => data.trade !== "other" || data.tradeOther.length > 0, {
    error: "Enter the trade.",
    path: ["tradeOther"],
    when: (payload) =>
      !payload.issues.some((issue) =>
        ["trade", "tradeOther"].includes(String(issue.path?.[0])),
      ),
  });

export async function createServiceRequest(
  _prevState: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const { workspace } = await requireWorkspace();

  const parsed = requestSchema.safeParse({
    customerName: String(formData.get("customerName") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    serviceAddress: String(formData.get("serviceAddress") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    tradeOther: String(formData.get("tradeOther") ?? ""),
    issueDescription: String(formData.get("issueDescription") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: RequestFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as RequestField;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors };
  }

  const link = newIntakeLink();
  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc(
    "create_service_request",
    {
      p_organization_id: workspace.id,
      p_customer_name: parsed.data.customerName,
      p_customer_phone: parsed.data.customerPhone,
      p_customer_email: parsed.data.customerEmail,
      p_service_address: parsed.data.serviceAddress,
      p_trade: parsed.data.trade,
      p_trade_other:
        parsed.data.trade === "other" ? parsed.data.tradeOther : null,
      p_issue_description: parsed.data.issueDescription,
      p_link_id: link.id,
      p_token_hash: link.tokenHash,
    },
  );

  if (error || typeof requestId !== "string") {
    return { error: "We couldn't create the request. Please try again." };
  }

  revalidatePath("/app/requests");
  redirect(`/app/requests/${requestId}?created=1`);
}

export async function regenerateIntakeLink(requestId: string) {
  await requireWorkspace();

  const link = newIntakeLink();
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_intake_link", {
    p_service_request_id: requestId,
    p_link_id: link.id,
    p_token_hash: link.tokenHash,
  });
  if (error) {
    return { error: "We couldn't create a new link. Please try again." };
  }

  revalidatePath(`/app/requests/${requestId}`);
  return {};
}

// Called after the contractor copies or shares the link. RLS limits the
// update to the user's workspace; only drafts move to "shared".
export async function markIntakeLinkShared(requestId: string) {
  const { workspace } = await requireWorkspace();
  const supabase = await createClient();
  await supabase
    .from("service_requests")
    .update({ intake_status: "shared" })
    .eq("id", requestId)
    .eq("organization_id", workspace.id)
    .eq("intake_status", "draft");

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
}
