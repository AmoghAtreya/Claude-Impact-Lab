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
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";
import { BriefPanel, CustomerAnswers } from "./brief-panel";
import { IntakeLinkPanel } from "./intake-link-panel";
import { ManageRequestPanel } from "./manage-request-panel";

export default function RequestPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-10 pt-3 sm:px-6">
      <Link href="/app/requests" className="inline-flex min-h-10 items-center self-start text-sm font-bold text-accent-strong">
        ← Requests
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
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

  const quickActions = [
    request.customerPhone ? ["📞 Call", `tel:${request.customerPhone}`] : null,
    request.customerPhone ? ["💬 Text", `sms:${request.customerPhone}`] : null,
    request.serviceAddress
      ? ["🧭 Directions", `https://maps.google.com/?q=${encodeURIComponent(request.serviceAddress)}`]
      : null,
  ].filter((a): a is string[] => a !== null);

  const details: [string, string | null][] = [
    ["Phone", request.customerPhone],
    ["Email", request.customerEmail],
    ["Service address", request.serviceAddress],
    ["Trade", tradeLabel(request.trade, request.tradeOther)],
    ["Issue", request.issueDescription],
  ];

  return (
    <>
      <header className="sticky top-16 z-10 -mx-4 border-b border-line bg-page px-4 pb-3 pt-1 sm:-mx-6 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[26px] font-extrabold leading-tight">
            {request.customerName}{" "}
            <span className="font-normal text-muted">{requestReference(request.number)}</span>
          </h1>
          <span
            className={`mt-1.5 shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
              request.intakeStatus === "submitted" ? "bg-ok-soft text-ok" : "bg-wait-soft text-wait"
            }`}
          >
            {request.reviewStatus === "archived" ? "Archived" : INTAKE_STATUS_LABELS[request.intakeStatus]}
          </span>
        </div>
        <p className="truncate text-sm text-muted">
          {[request.serviceAddress, request.issueDescription?.split("\n")[0]].filter(Boolean).join(" · ") ||
            `Created ${formatDateTime.format(new Date(request.createdAt))}`}
        </p>
        {quickActions.length ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {quickActions.map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="grid min-h-12 place-items-center rounded-xl border-[1.5px] border-line bg-white text-sm font-bold"
              >
                {label}
              </a>
            ))}
          </div>
        ) : null}
      </header>

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
        photos={photos}
        customerName={request.customerName}
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

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold">Details</h2>
          <Link
            href={`/app/requests/${request.id}/edit`}
            className="inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-bold"
          >
            Edit
          </Link>
        </div>
        <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="whitespace-pre-line text-sm text-ink">
                {value ?? <span className="text-muted/70">Not provided</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Customer photos</h2>
        {request.limitedVisualInfo ? (
          <p className="mb-4 rounded-xl border border-caution/40 bg-caution-soft p-3 text-sm text-caution">
            Limited visual information: the customer couldn&apos;t provide a
            photo.
          </p>
        ) : null}
        {request.customerDescription ? (
          <div className="mb-4 space-y-1">
            <p className="text-sm text-muted">
              Customer&apos;s description
            </p>
            <p className="whitespace-pre-line text-sm text-ink">
              {request.customerDescription}
            </p>
          </div>
        ) : null}
        {intake.brief && photos.length ? (
          <p className="text-sm text-muted">The photos are in the brief above. Tap one to see it full size.</p>
        ) : (
          <RequestPhotoGallery photos={photos} />
        )}
      </section>

      <ManageRequestPanel
        requestId={request.id}
        requestNumber={request.number}
        archived={request.reviewStatus === "archived"}
        canDelete={canManageWorkspace(workspace)}
        photoCount={photos.length}
        hasActiveLink={Boolean(link && !link.expired)}
      />
    </>
  );
}

function RequestPhotoGallery({ photos }: { photos: RequestPhoto[] }) {
  if (photos.length === 0) {
    return <p className="text-sm text-muted/70">No photos yet.</p>;
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
              className="block aspect-square overflow-hidden rounded-xl bg-chip"
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
            <p className="text-sm text-muted">{label}</p>
          </li>
        );
      })}
    </ul>
  );
}
