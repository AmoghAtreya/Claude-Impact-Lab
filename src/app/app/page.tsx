import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

export default function LoggedInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        You&apos;re logged in
      </h1>
      <Suspense
        fallback={<p className="text-base leading-7 text-neutral-500">Loading…</p>}
      >
        <SignedInAs />
      </Suspense>
      <p className="text-base leading-7 text-neutral-700">
        This is a placeholder for the contractor workspace.
      </p>
      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </main>
  );
}

async function SignedInAs() {
  const user = await getCurrentUser();
  return (
    <p className="text-base leading-7 text-neutral-700">
      Signed in as <span className="font-medium">{user.email}</span>
    </p>
  );
}
