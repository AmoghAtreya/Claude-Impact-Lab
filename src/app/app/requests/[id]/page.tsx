import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { statusClassName } from "@/app/ui/form-styles";
import { intakeUrl } from "@/lib/intake-links";
import {
  getServiceRequest,
  INTAKE_STATUS_LABELS,
  requestReference,
} from "@/lib/service-requests";
import { tradeLabel } from "@/lib/trades";
import { requireWorkspace } from "@/lib/workspace";
import { IntakeLinkPanel } from "./intake-link-panel";

export default function RequestPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/app/requests" className="text-sm text-neutral-600 underline">
        ← Requests
      </Link>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <RequestDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RequestDetail({
  params,
  searchParams,
}: Pick<PageProps<"/app/requests/[id]">, "params" | "searchParams">) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const { workspace } = await requireWorkspace();
  const request = await getServiceRequest(workspace.id, id);
  if (!request) {
    notFound();
  }

  const formatDateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: workspace.timezone,
  });
  const link = request.activeLink;
  const expiresAt = link ? new Date(link.expiresAt) : null;

  const details: [string, string | null][] = [
    ["Phone", request.customerPhone],
    ["Email", request.customerEmail],
    ["Service address", request.serviceAddress],
    ["Trade", tradeLabel(request.trade, request.tradeOther)],
    ["Issue", request.issueDescription],
  ];

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {request.customerName}{" "}
          <span className="font-normal text-neutral-500">
            {requestReference(request.number)}
          </span>
        </h1>
        <p className="text-sm text-neutral-600">
          {INTAKE_STATUS_LABELS[request.intakeStatus]} · Created{" "}
          {formatDateTime.format(new Date(request.createdAt))}
        </p>
      </div>

      {created ? (
        <p role="status" className={statusClassName}>
          Request created. Copy or share the link below to send it to{" "}
          {request.customerName}.
        </p>
      ) : null}

      <IntakeLinkPanel
        requestId={request.id}
        customerName={request.customerName}
        businessName={workspace.name}
        url={link ? await intakeUrl(link.id) : null}
        expiresLabel={expiresAt ? formatDateTime.format(expiresAt) : null}
        expired={link?.expired ?? false}
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Details</h2>
        <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-sm text-neutral-600">{label}</dt>
              <dd className="whitespace-pre-line text-sm text-neutral-900">
                {value ?? <span className="text-neutral-400">Not provided</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
