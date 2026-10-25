import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getServiceRequest, requestReference } from "@/lib/service-requests";
import { requireWorkspace } from "@/lib/workspace";
import { updateServiceRequest } from "../../actions";
import { RequestForm } from "../../request-form";

export default function EditRequestPage({
  params,
}: PageProps<"/app/requests/[id]/edit">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <EditRequest params={params} />
      </Suspense>
    </main>
  );
}

async function EditRequest({
  params,
}: Pick<PageProps<"/app/requests/[id]/edit">, "params">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const request = await getServiceRequest(workspace.id, id);
  if (!request) {
    notFound();
  }

  const detailHref = `/app/requests/${request.id}`;
  return (
    <>
      <div className="space-y-2">
        <Link href={detailHref} className="text-sm text-neutral-600 underline">
          ← {request.customerName} {requestReference(request.number)}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit request</h1>
        <p className="text-base leading-7 text-neutral-700">
          Changes apply right away. The customer&apos;s link stays the same.
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        {/* Next keeps visited pages mounted in the background, so without
            a key a reopened form would show values from before the last
            save. Keying on updated_at rebuilds it from the latest data. */}
        <RequestForm
          key={request.updatedAt}
          action={updateServiceRequest.bind(null, request.id)}
          initialValues={{
            customerName: request.customerName,
            customerPhone: request.customerPhone ?? "",
            customerEmail: request.customerEmail ?? "",
            serviceAddress: request.serviceAddress ?? "",
            trade: request.trade,
            tradeOther: request.tradeOther ?? "",
            issueDescription: request.issueDescription ?? "",
          }}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref={detailHref}
        />
      </div>
    </>
  );
}
