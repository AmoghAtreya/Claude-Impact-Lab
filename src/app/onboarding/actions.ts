"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { TRADES, type Trade } from "@/lib/trades";

export type OnboardingField =
  | "name"
  | "trade"
  | "contactEmail"
  | "contactPhone"
  | "timezone";

export type OnboardingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<OnboardingField, string>>;
  values?: Partial<Record<OnboardingField, string>>;
};

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const tradeValues = TRADES.map((trade) => trade.value) as [Trade, ...Trade[]];

const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter your business name." })
    .max(120, { error: "Keep the business name under 120 characters." }),
  trade: z.enum(tradeValues, { error: "Choose your trade." }),
  contactEmail: z
    .string()
    .trim()
    .pipe(z.email({ error: "Enter a valid email address." })),
  contactPhone: z
    .string()
    .trim()
    .max(40, { error: "Enter a shorter phone number." })
    .regex(/^[0-9+()\-.\s]*$/, {
      error: "Use digits, spaces, and + ( ) - . only.",
    }),
  timezone: z
    .string()
    .min(1, { error: "Choose your timezone." })
    .refine(isValidTimeZone, { error: "Choose a valid timezone." }),
});

export async function createWorkspace(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const { workspace } = await getCurrentWorkspace();
  if (workspace) {
    redirect("/app");
  }

  const values = {
    name: String(formData.get("name") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  };

  const parsed = workspaceSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: OnboardingFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as OnboardingField;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_trade: parsed.data.trade,
    p_contact_email: parsed.data.contactEmail,
    p_contact_phone: parsed.data.contactPhone,
    p_timezone: parsed.data.timezone,
  });

  // A double submit can race past the check above; the database rejects
  // the second workspace, and the first one is already usable.
  if (error && error.message !== "User already belongs to a workspace") {
    return {
      error: "We couldn't create your workspace. Please try again.",
      values,
    };
  }

  redirect("/app");
}
