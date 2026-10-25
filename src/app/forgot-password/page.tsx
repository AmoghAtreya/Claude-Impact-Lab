import Link from "next/link";
import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-base leading-7 text-neutral-700">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
      </div>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-neutral-700">
        Remembered it?{" "}
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      </p>
    </main>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: PageProps<"/forgot-password">["searchParams"];
}) {
  const { error } = await searchParams;
  return (
    <ForgotPasswordForm
      initialError={
        error === "expired"
          ? "That reset link is invalid or has expired. Request a new one."
          : undefined
      }
    />
  );
}
