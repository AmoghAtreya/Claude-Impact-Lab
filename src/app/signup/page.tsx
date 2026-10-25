import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthForm } from "@/app/auth/auth-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign up</h1>
        <p className="text-base leading-7 text-neutral-700">
          Create a contractor account to start sending intake links.
        </p>
      </div>
      <AuthForm
        action={signup}
        submitLabel="Create account"
        pendingLabel="Creating account…"
        passwordAutoComplete="new-password"
      />
      <p className="text-sm text-neutral-700">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
