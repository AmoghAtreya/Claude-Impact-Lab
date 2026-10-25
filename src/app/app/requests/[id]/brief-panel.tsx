import type { ReactNode } from "react";
import type { RequestIntakeView, StoredBrief } from "@/lib/intake-ai";
import { formatAnswer } from "@/lib/intake-questions";
import type { IntakeStatus } from "@/lib/service-requests";
import type { RequestPhoto } from "@/lib/intake-photos";
import { BriefAutoRefresh, RetryBriefButton } from "./brief-controls";
import { BriefPhotos } from "./brief-photos";

const sectionClassName = "rounded-2xl border border-line bg-white px-4 py-3";

// The AI service brief (spec B4), kept short: top possibility and summary,
// equipment, what to confirm on site, photos with the AI's notes. The rest
// folds under "Full brief". Everything here is AI-written and labeled so.
export function BriefPanel({
  requestId,
  intakeStatus,
  intake,
  photos,
  customerName,
  formatDateTime,
}: {
  requestId: string;
  intakeStatus: IntakeStatus;
  intake: RequestIntakeView;
  /** Photos in gallery order, to label references "Photo 1", "Photo 2". */
  photos: RequestPhoto[];
  customerName: string;
  formatDateTime: (iso: string) => string;
}) {
  const { brief, job } = intake;
  const photoIds = photos.map((photo) => photo.id);
  const working = job && (job.status === "pending" || job.status === "running") && !job.stale;
  const failed = job && (job.status === "failed" || job.stale);
  const photoRef = (ids: string[]) => refList(ids.map((id) => photoIds.indexOf(id) + 1).filter((n) => n > 0), "Photo");
  const questionRef = (ids: string[]) =>
    refList(ids.map((id) => intake.questions.findIndex((q) => q.id === id) + 1).filter((n) => n > 0), "Answer");
  const firstName = customerName.split(" ")[0];

  return (
    <section aria-labelledby="brief-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="brief-heading" className="font-display text-lg font-bold">
          Service brief
        </h2>
        <span className="text-xs text-muted">Written by AI · check against the photos</span>
      </div>

      {working ? (
        <div aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-[15px]">
          <span aria-hidden className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-line border-t-accent-strong" />
          Writing the brief… usually under a minute.
          <BriefAutoRefresh />
        </div>
      ) : null}

      {failed ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-danger-soft p-4 text-[15px] text-danger">
          <p>
            {brief
              ? "Updating the brief didn’t work. The last brief is shown below and may be out of date."
              : "The brief couldn’t be written. The customer’s photos and answers below are complete."}
          </p>
          <RetryBriefButton requestId={requestId} />
        </div>
      ) : null}

      {!brief && !working && !failed ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-white p-4">
          <p className="font-display text-lg font-bold">
            {intakeStatus === "submitted" ? "No brief yet" : `Waiting on ${firstName}’s photos`}
          </p>
          <p className="mt-1 text-[15px] text-muted">
            {intakeStatus === "submitted"
              ? "The customer’s photos and answers are below."
              : "Once they send photos, you’ll see the likely cause, what to confirm, and the photos with AI notes here."}
          </p>
        </div>
      ) : null}

      {brief ? (
        <BriefBody
          brief={brief.brief}
          photos={photos}
          questions={intake.questions}
          customerName={customerName}
          photoRef={photoRef}
          questionRef={questionRef}
        />
      ) : null}

      {brief ? (
        <p className="text-xs text-muted">
          Version {brief.version} · {formatDateTime(brief.createdAt)} · {brief.model}
        </p>
      ) : null}
    </section>
  );
}

function BriefBody({
  brief,
  photos,
  questions,
  customerName,
  photoRef,
  questionRef,
}: {
  brief: StoredBrief;
  photos: RequestPhoto[];
  questions: RequestIntakeView["questions"];
  customerName: string;
  photoRef: (ids: string[]) => string | null;
  questionRef: (ids: string[]) => string | null;
}) {
  const [top, ...others] = brief.possible_explanations;
  const viewerPhotos = photos
    .filter((p) => p.fullUrl ?? p.thumbnailUrl)
    .map((p, i) => ({ id: p.id, title: p.caption ?? `Photo ${i + 1}`, url: (p.fullUrl ?? p.thumbnailUrl)! }));
  // The AI cites photos but doesn't place pins, so notes show as a list.
  const notes = [
    ...brief.visual_observations.flatMap((o) => o.photo_ids.map((photoId) => ({ photoId, x: null, y: null, text: o.observation }))),
    ...brief.equipment.flatMap((e) =>
      e.photo_ids.map((photoId) => ({
        photoId,
        x: null,
        y: null,
        text: [e.make, e.description].filter(Boolean).join(" "),
        supports: e.model ? `Model ${e.model}${e.serial ? ` · Serial ${e.serial}` : ""}` : undefined,
      })),
    ),
  ];
  const answerNotes = brief.customer_reported
    .filter((r) => r.question_ids.length)
    .map((r) => ({
      quote: r.fact,
      supports: r.question_ids
        .map((id) => questions.find((q) => q.id === id)?.label)
        .filter(Boolean)
        .join(" · "),
    }));
  const hasMore =
    brief.customer_reported.length + brief.visual_observations.length + brief.contradictions.length > 0 ||
    Boolean(brief.symptom_timeline);

  return (
    <>
      {brief.urgent_concern ? (
        <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-[15px] font-semibold text-danger">
          ⚠ Possible safety concern: {brief.urgent_concern} Confirm with the customer before the visit.
        </p>
      ) : null}

      <div className="rounded-2xl border-2 border-ink bg-white p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          {top ? "Most likely · unconfirmed" : "Summary"}
        </span>
        {top ? <p className="mt-1 font-display text-xl font-extrabold leading-tight">{top.explanation}</p> : null}
        <p className="mt-1.5 text-base">{brief.summary}</p>
        {top?.basis ? <p className="mt-1.5 text-sm text-muted">Based on: {top.basis}</p> : null}
        {viewerPhotos.length ? (
          <a href="#brief-photos" className="mt-1 inline-flex min-h-12 items-center font-bold text-accent-strong">
            See the photos →
          </a>
        ) : null}
      </div>

      {brief.equipment.length ? (
        <Card title="Equipment">
          <ul>
            {brief.equipment.map((item, i) => (
              <li key={i} className="border-t border-line py-2 first:border-t-0">
                <b>{[item.make, item.description].filter(Boolean).join(" ")}</b>
                <span className="block text-sm text-muted">
                  Model <span className="font-mono text-ink">{item.model ?? "not legible"}</span>
                  {item.serial ? (
                    <>
                      {" "}· Serial <span className="font-mono text-ink">{item.serial}</span>
                    </>
                  ) : null}{" "}
                  <Ref text={photoRef(item.photo_ids)} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {brief.unresolved_questions.length ? (
        <Card title="Confirm on site">
          <ul className="mt-1 space-y-1.5 text-[15px]">
            {brief.unresolved_questions.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-muted">•</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {others.length ? (
        <p className="px-1 text-sm text-muted">
          Also possible: {others.map((o) => o.explanation).join(" · ")}
        </p>
      ) : null}

      <BriefPhotos photos={viewerPhotos} notes={notes} answerNotes={answerNotes} customerName={customerName} />

      {hasMore ? (
        <details className="rounded-2xl border border-line bg-white px-4 py-3">
          <summary className="flex min-h-10 cursor-pointer items-center font-bold">Full brief</summary>
          <div className="mt-2 flex flex-col gap-4">
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
            {brief.symptom_timeline ? (
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Timeline</h3>
                <p className="text-[15px]">{brief.symptom_timeline}</p>
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
            <BriefList title="Conflicting information">
              {brief.contradictions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </BriefList>
          </div>
        </details>
      ) : null}
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{title}</span>
      {children}
    </div>
  );
}

// The customer's own words, separate from anything the AI wrote.
export function CustomerAnswers({ intake }: { intake: RequestIntakeView }) {
  if (intake.questions.length === 0 && !intake.customerNote) return null;
  return (
    <details className={sectionClassName} aria-labelledby="answers-heading">
      <summary id="answers-heading" className="flex min-h-10 cursor-pointer items-center font-bold">
        Customer answers ({intake.questions.length})
      </summary>
      <p className="mb-2 text-sm text-muted">Questions written by AI; answers exactly as the customer gave them.</p>
      <ol>
        {intake.questions.map((q, i) => (
          <li key={q.id} className="border-t border-line py-2.5 text-[15px] first:border-t-0">
            <p className="text-muted">
              {i + 1}. {q.label}
            </p>
            <p className="whitespace-pre-line font-semibold">{formatAnswer(q.answer)}</p>
          </li>
        ))}
      </ol>
      {intake.customerNote ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-muted">Closing note</p>
          <p className="whitespace-pre-line text-ink">{intake.customerNote}</p>
        </div>
      ) : null}
    </details>
  );
}

function BriefList({ title, children }: { title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-6">{children}</ul>
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
