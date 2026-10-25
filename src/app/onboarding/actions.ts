"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { processAvatar, saveAvatar } from "@/lib/avatar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { TRADE_OTHER_MAX_LENGTH, TRADES, type Trade } from "@/lib/trades";
import { PHONE_PATTERN, PHONE_PATTERN_MESSAGE } from "@/lib/validation";

export type OnboardingField =
  | "avatar"
  | "name"
  | "trade"
  | "tradeOther"
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

const workspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Enter your business name." })
      .max(120, { error: "Keep the business name under 120 characters." }),
    trade: z.enum(tradeValues, { error: "Choose your trade." }),
    tradeOther: z
      .string()
      .trim()
      .max(TRADE_OTHER_MAX_LENGTH, {
        error: `Keep your trade under ${TRADE_OTHER_MAX_LENGTH} characters.`,
      }),
    contactEmail: z
      .string()
      .trim()
      .pipe(z.email({ error: "Enter a valid email address." })),
    contactPhone: z
      .string()
      .trim()
      .max(40, { error: "Enter a shorter phone number." })
      .regex(PHONE_PATTERN, { error: PHONE_PATTERN_MESSAGE }),
    timezone: z
      .string()
      .min(1, { error: "Choose your timezone." })
      .refine(isValidTimeZone, { error: "Choose a valid timezone." }),
  })
  .refine((data) => data.trade !== "other" || data.tradeOther.length > 0, {
    error: "Enter your trade.",
    path: ["tradeOther"],
    // Run even when other fields are invalid, so all errors show at once.
    when: (payload) =>
      !payload.issues.some((issue) =>
        ["trade", "tradeOther"].includes(String(issue.path?.[0])),
      ),
  });

export async function createWorkspace(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const { user, workspace } = await getCurrentWorkspace();
  if (workspace) {
    redirect("/app");
  }

  const values = {
    name: String(formData.get("name") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    tradeOther: String(formData.get("tradeOther") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  };

  const avatarFile = formData.get("avatar");
  const avatar =
    avatarFile instanceof File && avatarFile.size > 0
      ? await processAvatar(avatarFile)
      : null;

  const parsed = workspaceSchema.safeParse(values);
  if (!parsed.success || (avatar && !avatar.ok)) {
    const fieldErrors: OnboardingFormState["fieldErrors"] = {};
    for (const issue of parsed.error?.issues ?? []) {
      const field = issue.path[0] as OnboardingField;
      fieldErrors[field] ??= issue.message;
    }
    if (avatar && !avatar.ok) {
      fieldErrors.avatar = avatar.error;
    }
    return { fieldErrors, values };
  }

  // Upload before creating the workspace so a failure leaves nothing
  // half-finished; a retry overwrites the same file.
  if (avatar) {
    const saved = await saveAvatar(user.id, avatar.data);
    if (!saved.ok) {
      return {
        fieldErrors: {
          avatar:
            "We couldn't upload your picture. Try again, or remove it and add one later.",
        },
        values,
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_trade: parsed.data.trade,
    p_trade_other: parsed.data.trade === "other" ? parsed.data.tradeOther : null,
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
