import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/workspace";
import { NewRequestForm } from "./new-request-form";

export default function NewRequestPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Link href="/app/requests" className="text-sm text-neutral-600 underline">
          ← Requests
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="text-base leading-7 text-neutral-700">
          Add what you already know. You&apos;ll get a private link to send the
          customer so they can photograph the problem and answer a few
          questions.
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <Suspense
          fallback={<p className="text-sm text-neutral-500">Loading…</p>}
        >
          <Form />
        </Suspense>
      </div>
    </main>
  );
}

async function Form() {
  const { workspace } = await requireWorkspace();
  return (
    <NewRequestForm
      defaultTrade={workspace.trade}
      defaultTradeOther={workspace.tradeOther}
    />
  );
}
