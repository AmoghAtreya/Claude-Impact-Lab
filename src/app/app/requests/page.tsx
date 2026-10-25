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
  type IntakeStatus,
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
        <h1 className="font-display text-[28px] font-extrabold tracking-tight">Requests</h1>
        <Link href="/app/requests/new" className={primaryButtonClassName}>
          + New request
        </Link>
      </div>
      <Suspense fallback={null}>
        <DeletedNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
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
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line bg-white p-6">
        <h2 className="font-display text-lg font-bold">No requests yet</h2>
        <p className="text-sm leading-6 text-muted">
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

      <p aria-live="polite" className="text-sm text-muted">
        {total === 1 ? "1 request" : `${total} requests`}
        {filtered ? " match your filters" : ""}
      </p>

      {requests.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line bg-white p-6">
          <h2 className="font-display text-lg font-bold">No matching requests</h2>
          <p className="text-sm leading-6 text-muted">
            Try a different search or fewer filters.
          </p>
          <Link href="/app/requests" className="text-sm font-bold text-accent-strong underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
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

// Status pills: grey = waiting, green = ready, red only for failures.
const INTAKE_TONES: Record<IntakeStatus, string> = {
  draft: "bg-wait-soft text-wait",
  shared: "bg-wait-soft text-wait",
  in_progress: "bg-accent-soft text-accent-strong",
  submitted: "bg-ok-soft text-ok",
};

const ANALYSIS_TONES: Record<AnalysisStatus, string> = {
  not_started: "bg-wait-soft text-wait",
  pending: "bg-wait-soft text-wait",
  running: "bg-accent-soft text-accent-strong",
  succeeded: "bg-ok-soft text-ok",
  failed: "bg-danger-soft text-danger",
};

const pillClassName = "rounded-lg px-2 py-0.5 text-xs font-bold";

function RequestRow({
  request,
  sort,
  format,
}: {
  request: ListedServiceRequest;
  sort: RequestListParams["sort"];
  format: (iso: string) => string;
}) {
  // Show the timestamp the list is sorted by.
  const sortedTime =
    sort === "activity"
      ? `Active ${format(request.lastActivityAt)}`
      : sort === "submitted"
        ? request.submittedAt
          ? `Submitted ${format(request.submittedAt)}`
          : "Not submitted"
        : `Created ${format(request.createdAt)}`;
  // Analysis only means something once the customer has submitted.
  const showAnalysis = request.intakeStatus === "submitted";

  return (
    <li>
      <Link
        href={`/app/requests/${request.id}`}
        className="flex min-h-[84px] flex-col gap-1.5 rounded-2xl border-[1.5px] border-line bg-white p-4 hover:border-ink"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-bold">
            {request.customerName}{" "}
            <span className="font-normal text-muted">{requestReference(request.number)}</span>
          </p>
          <span className="shrink-0 text-xs text-muted">{sortedTime}</span>
        </div>
        <p className="truncate text-sm text-muted">{request.serviceAddress ?? "No address yet"}</p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {showAnalysis ? (
            <span className={`${pillClassName} ${ANALYSIS_TONES[request.analysisStatus]}`}>
              {ANALYSIS_STATUS_LABELS[request.analysisStatus]}
            </span>
          ) : (
            <span className={`${pillClassName} ${INTAKE_TONES[request.intakeStatus]}`}>
              {INTAKE_STATUS_LABELS[request.intakeStatus]}
            </span>
          )}
          {request.reviewStatus !== "unreviewed" ? (
            <span className={`${pillClassName} bg-chip text-ink`}>
              {REVIEW_STATUS_LABELS[request.reviewStatus]}
            </span>
          ) : null}
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
    "inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-line bg-white px-4 text-sm font-bold";
  const disabledClassName =
    "inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-line px-4 text-sm text-muted/70";
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
      <p className="text-sm text-muted">
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
