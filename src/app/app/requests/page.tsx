import Link from "next/link";
import { Suspense } from "react";
import { primaryButtonClassName } from "@/app/ui/form-styles";
import {
  INTAKE_STATUS_LABELS,
  listServiceRequests,
  requestReference,
} from "@/lib/service-requests";
import { requireWorkspace } from "@/lib/workspace";

// A minimal list so new requests are reachable. Search, filters, sorting,
// and pagination arrive with B3.
export default function RequestsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <Link href="/app/requests/new" className={primaryButtonClassName}>
          New request
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <RequestList />
      </Suspense>
    </main>
  );
}

async function RequestList() {
  const { workspace } = await requireWorkspace();
  const requests = await listServiceRequests(workspace.id);
  const formatDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: workspace.timezone,
  });

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-6">
        <h2 className="text-base font-semibold">No requests yet</h2>
        <p className="text-sm leading-6 text-neutral-700">
          Create a request for a customer to get a private link you can send by
          text, WhatsApp, or email.
        </p>
        <Link href="/app/requests/new" className={primaryButtonClassName}>
          Add your first request
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            href={`/app/requests/${request.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {request.customerName}{" "}
                <span className="font-normal text-neutral-500">
                  {requestReference(request.number)}
                </span>
              </p>
              <p className="truncate text-sm text-neutral-600">
                {request.serviceAddress ?? "No address yet"}
              </p>
            </div>
            <div className="shrink-0 text-right text-sm">
              <p className="text-neutral-800">
                {INTAKE_STATUS_LABELS[request.intakeStatus]}
              </p>
              <p className="text-neutral-500">
                {formatDate.format(new Date(request.createdAt))}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
