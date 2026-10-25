import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { primaryButtonClassName, statusClassName } from "@/app/ui/form-styles";
import {
  ANALYSIS_STATUS_LABELS,
  hasActiveFilters,
  INTAKE_STATUS_LABELS,
  parseRequestListParams,
  REQUEST_SORTS,
  REQUESTS_PAGE_SIZE,
  requestReference,
  REVIEW_FILTERS,
  REVIEW_STATUS_LABELS,
  searchServiceRequests,
  type AnalysisStatus,
  type ListedServiceRequest,
  type RequestListParams,
} from "@/lib/service-requests";
import { requireWorkspace } from "@/lib/workspace";
import { RequestFilters } from "./request-filters";

export default function RequestsPage({
  searchParams,
}: PageProps<"/app/requests">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <Link href="/app/requests/new" className={primaryButtonClassName}>
          New request
        </Link>
      </div>
      <Suspense fallback={null}>
        <DeletedNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <RequestList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Shown after a request is deleted from its detail page.
async function DeletedNotice({
  searchParams,
}: Pick<PageProps<"/app/requests">, "searchParams">) {
  const { deleted } = await searchParams;
  if (typeof deleted !== "string" || !/^[0-9]{1,9}$/.test(deleted)) {
    return null;
  }
  return (
    <p role="status" className={statusClassName}>
      Request {requestReference(Number(deleted))} and its photos were deleted.
    </p>
  );
}

async function RequestList({
  searchParams,
}: Pick<PageProps<"/app/requests">, "searchParams">) {
  const params = parseRequestListParams(await searchParams);
  const { workspace } = await requireWorkspace();
  const { requests, total } = await searchServiceRequests(workspace.id, params);
  // The total comes with the rows, so a page past the end looks empty.
  if (requests.length === 0 && params.page > 1) {
    redirect(pageHref(params, 1));
  }
  const filtered = hasActiveFilters(params);
  const pageCount = Math.max(1, Math.ceil(total / REQUESTS_PAGE_SIZE));

  const formatDateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: workspace.timezone,
  });

  // No requests at all: skip the filters and point at the first action.
  if (total === 0 && !filtered) {
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
    <div className="flex flex-col gap-4">
      <RequestFilters
        q={params.q}
        status={params.status ?? ""}
        review={params.review}
        sort={params.sort}
        statusOptions={[
          { value: "", label: "All" },
          ...Object.entries(INTAKE_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        reviewOptions={Object.entries(REVIEW_FILTERS).map(([value, label]) => ({
          value,
          label,
        }))}
        sortOptions={Object.entries(REQUEST_SORTS).map(([value, label]) => ({
          value,
          label,
        }))}
        showClear={filtered || params.sort !== "created"}
      />

      <p aria-live="polite" className="text-sm text-neutral-600">
        {total === 1 ? "1 request" : `${total} requests`}
        {filtered ? " match your filters" : ""}
      </p>

      {requests.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-6">
          <h2 className="text-base font-semibold">No matching requests</h2>
          <p className="text-sm leading-6 text-neutral-700">
            Try a different search or fewer filters.
          </p>
          <Link href="/app/requests" className="text-sm underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              sort={params.sort}
              format={(iso) => formatDateTime.format(new Date(iso))}
            />
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <Pagination params={params} pageCount={pageCount} />
      ) : null}
    </div>
  );
}

const ANALYSIS_TONES: Record<AnalysisStatus, string> = {
  not_started: "bg-neutral-100 text-neutral-600",
  pending: "bg-sky-50 text-sky-800",
  running: "bg-sky-50 text-sky-800",
  succeeded: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-800",
};

function RequestRow({
  request,
  sort,
  format,
}: {
  request: ListedServiceRequest;
  sort: RequestListParams["sort"];
  format: (iso: string) => string;
}) {
  // Show the timestamp the list is sorted by, plus last updated.
  const sortedTime =
    sort === "activity"
      ? `Active ${format(request.lastActivityAt)}`
      : sort === "submitted"
        ? request.submittedAt
          ? `Submitted ${format(request.submittedAt)}`
          : "Not submitted"
        : `Created ${format(request.createdAt)}`;

  return (
    <li>
      <Link
        href={`/app/requests/${request.id}`}
        className="flex flex-col gap-2 px-4 py-3 hover:bg-neutral-50 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">
            {request.customerName}{" "}
            <span className="font-normal text-neutral-500">
              {requestReference(request.number)}
            </span>
          </p>
          <p className="truncate text-sm text-neutral-600">
            {request.serviceAddress ?? "No address yet"}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5 text-xs font-medium">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-800">
              {INTAKE_STATUS_LABELS[request.intakeStatus]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${ANALYSIS_TONES[request.analysisStatus]}`}
            >
              {ANALYSIS_STATUS_LABELS[request.analysisStatus]}
            </span>
            {request.reviewStatus !== "unreviewed" ? (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-800">
                {REVIEW_STATUS_LABELS[request.reviewStatus]}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-sm text-neutral-500 sm:text-right">
          <p>Updated {format(request.updatedAt)}</p>
          <p>{sortedTime}</p>
        </div>
      </Link>
    </li>
  );
}

function pageHref(params: RequestListParams, page: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.review !== "active") search.set("review", params.review);
  if (params.sort !== "created") search.set("sort", params.sort);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/app/requests?${query}` : "/app/requests";
}

function Pagination({
  params,
  pageCount,
}: {
  params: RequestListParams;
  pageCount: number;
}) {
  const linkClassName =
    "inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium";
  const disabledClassName =
    "inline-flex h-9 items-center rounded-md border border-neutral-200 px-3 text-sm text-neutral-400";
  const { page } = params;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4"
    >
      {page > 1 ? (
        <Link href={pageHref(params, page - 1)} className={linkClassName}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClassName}>
          Previous
        </span>
      )}
      <p className="text-sm text-neutral-600">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={pageHref(params, page + 1)} className={linkClassName}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClassName}>
          Next
        </span>
      )}
    </nav>
  );
}
