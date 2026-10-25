import Link from "next/link";

export default function LoggedInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        You&apos;re logged in
      </h1>
      <p className="text-base leading-7 text-neutral-700">
        This is a placeholder for the contractor workspace. Sign-in is not
        connected yet.
      </p>
      <Link href="/" className="text-sm underline">
        Back to home
      </Link>
    </main>
  );
}
