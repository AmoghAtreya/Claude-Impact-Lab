import type { ReactNode } from "react";
import type { RequestIntakeView, StoredBrief } from "@/lib/intake-ai";
import { formatAnswer } from "@/lib/intake-questions";
import type { IntakeStatus } from "@/lib/service-requests";
import { BriefAutoRefresh, RetryBriefButton } from "./brief-controls";

const sectionClassName = "rounded-2xl border border-line bg-white p-5 sm:p-6";

// The AI service brief (spec B4). Everything here is AI-written from the
// customer's photos and answers, and labeled as such; the original photos
// and answers are shown below it.
export function BriefPanel({
  requestId,
  intakeStatus,
  intake,
  photoIds,
  formatDateTime,
}: {
  requestId: string;
  intakeStatus: IntakeStatus;
  intake: RequestIntakeView;
  /** Photo ids in gallery order, to label references "Photo 1", "Photo 2". */
  photoIds: string[];
  formatDateTime: (iso: string) => string;
}) {
  const { brief, job } = intake;
  const working = job && (job.status === "pending" || job.status === "running") && !job.stale;
  const failed = job && (job.status === "failed" || job.stale);
  const photoRef = (ids: string[]) => refList(ids.map((id) => photoIds.indexOf(id) + 1).filter((n) => n > 0), "Photo");
  const questionRef = (ids: string[]) =>
    refList(ids.map((id) => intake.questions.findIndex((q) => q.id === id) + 1).filter((n) => n > 0), "Answer");

  return (
    <section className={sectionClassName} aria-labelledby="brief-heading">
      <div className="mb-4 space-y-1">
        <h2 id="brief-heading" className="text-base font-semibold">
          Service brief
        </h2>
        <p className="text-sm text-muted">
          Written by AI from the customer’s photos and answers. Check it against the photos before relying on it.
        </p>
      </div>

      {working ? (
        <div aria-live="polite" className="mb-4 rounded-xl border border-line bg-page p-4 text-sm text-ink">
          Writing the brief… This usually takes under a minute.
          <BriefAutoRefresh />
        </div>
      ) : null}

      {failed ? (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
          <p>
            {brief
              ? "Updating the brief didn’t work. The last brief is shown below and may be out of date."
              : "The brief couldn’t be written. The customer’s photos and answers below are complete."}
          </p>
          <RetryBriefButton requestId={requestId} />
        </div>
      ) : null}

      {!brief && !working && !failed ? (
        <p className="text-sm text-muted">
          {intakeStatus === "submitted"
            ? "No brief yet."
            : "The brief appears here after the customer sends their photos and answers."}
        </p>
      ) : null}

      {brief ? (
        <BriefBody brief={brief.brief} photoRef={photoRef} questionRef={questionRef} />
      ) : null}

      {brief ? (
        <p className="mt-4 text-xs text-muted">
          Version {brief.version} · {formatDateTime(brief.createdAt)} · {brief.model}
        </p>
      ) : null}
    </section>
  );
}

function BriefBody({
  brief,
  photoRef,
  questionRef,
}: {
  brief: StoredBrief;
  photoRef: (ids: string[]) => string | null;
  questionRef: (ids: string[]) => string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {brief.urgent_concern ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm leading-6 text-danger">
          <span className="font-medium">Possible safety concern:</span> {brief.urgent_concern} Confirm with the customer
          before the visit.
        </p>
      ) : null}

      <p className="text-base leading-7 text-ink">{brief.summary}</p>

      <BriefList title="What the customer reported">
        {brief.customer_reported.map((item, i) => (
          <li key={i}>
            {item.fact} <Ref text={questionRef(item.question_ids) ?? sourceLabel(item.sources)} />
          </li>
        ))}
      </BriefList>

      <BriefList title="What the photos show">
        {brief.visual_observations.map((item, i) => (
          <li key={i}>
            {item.observation} <Ref text={photoRef(item.photo_ids)} />
          </li>
        ))}
      </BriefList>

      <BriefList title="Equipment">
        {brief.equipment.map((item, i) => (
          <li key={i}>
            {item.description}
            <span className="block text-muted">
              Make: {item.make ?? "not legible"} · Model: {item.model ?? "not legible"}
              {item.serial ? ` · Serial: ${item.serial}` : ""} <Ref text={photoRef(item.photo_ids)} />
            </span>
          </li>
        ))}
      </BriefList>

      {brief.symptom_timeline ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <p className="text-sm leading-6 text-ink">{brief.symptom_timeline}</p>
        </div>
      ) : null}

      <BriefList title="Possible causes (unconfirmed)">
        {brief.possible_explanations.map((item, i) => (
          <li key={i}>
            {item.explanation}
            {item.basis ? <span className="block text-muted">Based on: {item.basis}</span> : null}
          </li>
        ))}
      </BriefList>

      <BriefList title="Still to confirm">
        {brief.unresolved_questions.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </BriefList>

      <BriefList title="Conflicting information">
        {brief.contradictions.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </BriefList>
    </div>
  );
}

// The customer's own words, separate from anything the AI wrote.
export function CustomerAnswers({ intake }: { intake: RequestIntakeView }) {
  if (intake.questions.length === 0 && !intake.customerNote) return null;
  return (
    <section className={sectionClassName} aria-labelledby="answers-heading">
      <div className="mb-4 space-y-1">
        <h2 id="answers-heading" className="text-base font-semibold">
          Customer answers
        </h2>
        <p className="text-sm text-muted">Questions written by AI; answers exactly as the customer gave them.</p>
      </div>
      <ol className="flex flex-col gap-4">
        {intake.questions.map((q, i) => (
          <li key={q.id} className="space-y-1 text-sm">
            <p className="text-muted">
              Answer {i + 1}. {q.label}
            </p>
            <p className="whitespace-pre-line text-ink">{formatAnswer(q.answer)}</p>
          </li>
        ))}
      </ol>
      {intake.customerNote ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-muted">Closing note</p>
          <p className="whitespace-pre-line text-ink">{intake.customerNote}</p>
        </div>
      ) : null}
    </section>
  );
}

function BriefList({ title, children }: { title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink">{children}</ul>
    </div>
  );
}

function Ref({ text }: { text: string | null }) {
  return text ? <span className="text-muted">({text})</span> : null;
}

function refList(numbers: number[], noun: string) {
  if (numbers.length === 0) return null;
  return numbers.length === 1 ? `${noun} ${numbers[0]}` : `${noun}s ${numbers.join(", ")}`;
}

function sourceLabel(sources: string[]) {
  const labels: Record<string, string> = { description: "description", note: "closing note", caption: "photo caption" };
  const named = sources.map((s) => labels[s]).filter(Boolean);
  return named.length ? named.join(", ") : null;
}
