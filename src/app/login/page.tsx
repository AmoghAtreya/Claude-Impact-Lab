import Link from "next/link";
import { Suspense } from "react";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/app/auth/auth-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
      <div className="flex flex-col gap-2 text-sm text-neutral-700">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/signup" className="underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  return (
    <AuthForm
      action={login}
      submitLabel="Log in"
      pendingLabel="Logging in…"
      passwordAutoComplete="current-password"
      initialError={
        error === "confirmation"
          ? "That confirmation link is invalid or has expired. Try logging in, or sign up again."
          : undefined
      }
    />
  );
}
