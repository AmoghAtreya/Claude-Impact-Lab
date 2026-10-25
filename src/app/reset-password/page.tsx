import Link from "next/link";
import { Suspense } from "react";
import { statusClassName } from "@/app/ui/form-styles";
import { getOptionalUser } from "@/lib/auth";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      <Suspense>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}

async function ResetPasswordContent() {
  // The emailed reset link signs the user in via /auth/confirm first.
  const user = await getOptionalUser();
  if (!user) {
    return (
      <p role="status" className={statusClassName}>
        This reset link has expired or was already used.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <p className="text-base leading-7 text-neutral-700">
        Resetting the password for{" "}
        <span className="font-medium">{user.email}</span>.
      </p>
      <ResetPasswordForm />
    </>
  );
}
