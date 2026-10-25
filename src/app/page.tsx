import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Technician Intake
        </h1>
        <p className="text-base leading-7 text-neutral-700">
          Customers open a link, photograph the problem, and answer a few
          questions. Contractors review a structured brief before the visit.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 px-4 text-sm font-medium"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
