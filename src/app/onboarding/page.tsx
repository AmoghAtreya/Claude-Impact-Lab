import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { getCurrentWorkspace } from "@/lib/workspace";
import { TIME_ZONES } from "@/lib/workspace-schema";
import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Set up your business
        </h1>
        <p className="text-base leading-7 text-neutral-700">
          Customers see your business name and contact details when they open
          an intake link.
        </p>
      </div>
      <Suspense
        fallback={<p className="text-base leading-7 text-neutral-500">Loading…</p>}
      >
        <Onboarding />
      </Suspense>
      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </main>
  );
}

async function Onboarding() {
  const { user, workspace } = await getCurrentWorkspace();
  if (workspace) {
    redirect("/app");
  }
  return <OnboardingForm defaultEmail={user.email} timeZones={TIME_ZONES} />;
}
