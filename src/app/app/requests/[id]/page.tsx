import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { statusClassName } from "@/app/ui/form-styles";
import { getRequestIntake } from "@/lib/intake-ai";
import { intakeUrl } from "@/lib/intake-links";
import { listRequestPhotos, type RequestPhoto } from "@/lib/intake-photos";
import {
  getServiceRequest,
  INTAKE_STATUS_LABELS,
  requestReference,
} from "@/lib/service-requests";
import { tradeLabel } from "@/lib/trades";
import { requireWorkspace } from "@/lib/workspace";
import { BriefPanel, CustomerAnswers } from "./brief-panel";
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
  const [{ id }, { created, updated }] = await Promise.all([
    params,
    searchParams,
  ]);
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
  const [photos, intake] = await Promise.all([
    listRequestPhotos(workspace.id, request.id),
    getRequestIntake(workspace.id, request.id),
  ]);

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
      ) : updated ? (
        <p role="status" className={statusClassName}>
          Changes saved.
        </p>
      ) : null}

      <BriefPanel
        requestId={request.id}
        intakeStatus={request.intakeStatus}
        intake={intake}
        photoIds={photos.map((photo) => photo.id)}
        formatDateTime={(iso) => formatDateTime.format(new Date(iso))}
      />

      <CustomerAnswers intake={intake} />

      <IntakeLinkPanel
        requestId={request.id}
        customerName={request.customerName}
        businessName={workspace.name}
        url={link ? await intakeUrl(link.id) : null}
        expiresLabel={expiresAt ? formatDateTime.format(expiresAt) : null}
        expired={link?.expired ?? false}
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Details</h2>
          <Link
            href={`/app/requests/${request.id}/edit`}
            className="inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium"
          >
            Edit
          </Link>
        </div>
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

      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Customer photos</h2>
        {request.limitedVisualInfo ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Limited visual information: the customer couldn&apos;t provide a
            photo.
          </p>
        ) : null}
        {request.customerDescription ? (
          <div className="mb-4 space-y-1">
            <p className="text-sm text-neutral-600">
              Customer&apos;s description
            </p>
            <p className="whitespace-pre-line text-sm text-neutral-900">
              {request.customerDescription}
            </p>
          </div>
        ) : null}
        <RequestPhotoGallery photos={photos} />
      </section>
    </>
  );
}

function RequestPhotoGallery({ photos }: { photos: RequestPhoto[] }) {
  if (photos.length === 0) {
    return <p className="text-sm text-neutral-400">No photos yet.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {photos.map((photo, index) => {
        const label = photo.caption
          ? `Photo ${index + 1}: ${photo.caption}`
          : `Photo ${index + 1}`;
        return (
          <li key={photo.id} className="space-y-1.5">
            <a
              href={photo.fullUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="block aspect-square overflow-hidden rounded-md bg-neutral-100"
            >
              {photo.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img
                  src={photo.thumbnailUrl}
                  alt={label}
                  className="size-full object-contain"
                />
              ) : null}
            </a>
            <p className="text-sm text-neutral-700">{label}</p>
          </li>
        );
      })}
    </ul>
  );
}
