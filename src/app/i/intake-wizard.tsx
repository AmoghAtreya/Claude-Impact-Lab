"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HVAC_PHOTO_PROMPTS, analyzeIntake, readPhoto } from "@/lib/intake-demo";
import { INTAKE_PHOTO_MAX_BYTES, type IntakePhoto } from "@/lib/intake-photo-rules";
import type { IntakeAnalysis, IntakeAnswers, IntakeQuestion, PhotoReading } from "@/lib/intake-types";

// Where a photo is in being saved. "local" photos (preview, demo) are never uploaded.
type PhotoUpload =
  | { status: "local" }
  | { status: "uploading"; progress: number }
  | { status: "saved"; id: string }
  | { status: "failed"; error: string; retryable: boolean; file: File; replaces: string | null };
type Photo = { url: string; reading: PhotoReading | null; upload: PhotoUpload };
type Step =
  | { kind: "welcome" }
  | { kind: "photo"; index: number }
  | { kind: "reading" }
  | { kind: "question"; index: number }
  | { kind: "describe" }
  | { kind: "review" }
  | { kind: "done" };

// Photo-first customer intake: photos → "looking at your photos" → questions
// written from the photos → review → sent. See docs/design/README.md.
export function IntakeWizard({
  businessName,
  customerName,
  businessPhone,
  embedded = false,
  live,
}: {
  businessName: string;
  customerName: string;
  businessPhone?: string | null;
  /** Inside the contractor preview card instead of full screen. */
  embedded?: boolean;
  /** A real intake link: photos upload as they're taken and are restored on reload. */
  live?: { token: string; photos: IntakePhoto[] };
}) {
  const prompts = HVAC_PHOTO_PROMPTS;
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [photos, setPhotos] = useState<(Photo | null)[]>(() =>
    prompts.map((prompt) => {
      const saved = live?.photos.find((photo) => photo.promptId === prompt.id);
      return saved ? { url: saved.thumbnailUrl, reading: null, upload: { status: "saved", id: saved.id } } : null;
    }),
  );
  const [analysis, setAnalysis] = useState<IntakeAnalysis | null>(null);
  const [readCount, setReadCount] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [note, setNote] = useState("");

  // Every preview URL we create, revoked when the wizard unmounts.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Photos saved on an earlier visit still need a reading.
  useEffect(() => {
    prompts.forEach((prompt, index) => {
      if (!live?.photos.some((photo) => photo.promptId === prompt.id)) return;
      readPhoto(prompt.id).then((reading) =>
        setPhotos((prev) => prev.map((p, i) => (i === index && p && !p.reading ? { ...p, reading } : p))),
      );
    });
    // Only for what the page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start analysis as soon as we reach the reading screen; tick the steps off.
  useEffect(() => {
    if (step.kind !== "reading") return;
    let cancelled = false;
    analyzeIntake().then((result) => {
      if (cancelled) return;
      setAnalysis(result);
      result.steps.forEach((_, i) =>
        setTimeout(() => !cancelled && setReadCount(i + 1), 700 * (i + 1)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [step.kind]);

  const questions = (analysis?.questions ?? []).filter(
    (q) => !q.showIf || answers[q.showIf.questionId] !== q.showIf.notAnswer,
  );
  const firstName = businessName.split(" ")[0];

  function goToReading() {
    setReadCount(0);
    setStep({ kind: "reading" });
  }

  function setUpload(index: number, url: string, upload: PhotoUpload) {
    setPhotos((prev) => prev.map((p, i) => (i === index && p?.url === url ? { ...p, upload } : p)));
  }

  // Uploads in the background so the customer is never blocked. Network
  // failures retry automatically before asking the customer.
  async function savePhoto(index: number, url: string, file: File, replaces: string | null) {
    if (!live) return;
    for (let attempt = 0; ; attempt++) {
      setUpload(index, url, { status: "uploading", progress: 0 });
      const result = await uploadPhoto(live.token, file, prompts[index].id, replaces, (progress) =>
        setUpload(index, url, { status: "uploading", progress }),
      );
      if (result.ok) {
        setUpload(index, url, { status: "saved", id: result.photo.id });
        return;
      }
      if (!result.retryable || attempt >= 2) {
        setUpload(index, url, { status: "failed", error: result.error, retryable: result.retryable, file, replaces });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }

  function addPhoto(index: number, file: File) {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const previous = photos[index];
    // A retake replaces the saved photo for this prompt.
    const replaces =
      previous?.upload.status === "saved"
        ? previous.upload.id
        : previous?.upload.status === "failed"
          ? previous.upload.replaces
          : null;
    const tooLarge = file.size > INTAKE_PHOTO_MAX_BYTES;
    const upload: PhotoUpload = !live
      ? { status: "local" }
      : tooLarge
        ? { status: "failed", error: "This photo is larger than 10 MB. Retake it or choose a smaller one.", retryable: false, file, replaces }
        : { status: "uploading", progress: 0 };
    setPhotos((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]!.url);
      next[index] = { url, reading: null, upload };
      return next;
    });
    readPhoto(prompts[index].id).then((reading) =>
      setPhotos((prev) => {
        const next = [...prev];
        if (next[index]?.url === url) next[index] = { ...next[index]!, reading };
        return next;
      }),
    );
    if (upload.status === "uploading") void savePhoto(index, url, file, replaces);
  }

  if (step.kind === "welcome") {
    return (
      <Screen
        embedded={embedded}
        action={<Primary onClick={() => setStep({ kind: "photo", index: 0 })}>Start with photos</Primary>}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-ink font-display font-extrabold text-white">
            {initials(businessName)}
          </div>
          <div>
            <b>{businessName}</b>
            {businessPhone ? <p className="text-sm text-muted">{businessPhone}</p> : null}
          </div>
        </div>
        <h1 className="mt-6 font-display text-[30px] font-bold leading-[1.08] tracking-tight">
          Hi {customerName}, help us fix it in one trip.
        </h1>
        <p className="mt-2 text-muted">{businessName} asked for a few photos so they bring the right parts.</p>
        <div className="my-5 grid grid-cols-3 gap-2.5 text-center text-sm">
          <Effort big={String(prompts.length)} label="photos" />
          <Effort big="~3" label="quick taps" />
          <Effort big="90s" label="total" />
        </div>
        <p className="text-sm text-muted">
          No app or account. Only {businessName} sees your photos. We’ll never ask you to open covers or touch
          wiring. Submitting doesn’t book an appointment.
        </p>
      </Screen>
    );
  }

  if (step.kind === "photo") {
    const prompt = prompts[step.index];
    const photo = photos[step.index];
    const isLast = step.index === prompts.length - 1;
    const unusable = photo?.upload.status === "failed" && !photo.upload.retryable;
    const next = () => (isLast ? goToReading() : setStep({ kind: "photo", index: step.index + 1 }));
    return (
      <Screen
        embedded={embedded}
        back={() => setStep(step.index === 0 ? { kind: "welcome" } : { kind: "photo", index: step.index - 1 })}
        action={
          photo ? (
            <>
              <PhotoInput
                capture
                onFile={(f) => addPhoto(step.index, f)}
                variant="ghost"
                disabled={photo.upload.status === "uploading"}
              >
                Retake
              </PhotoInput>
              <Primary onClick={next} disabled={!photo.reading || unusable} grow>
                {photo.reading ? (isLast ? "Done with photos" : "Next photo") : "Checking…"}
              </Primary>
            </>
          ) : (
            <>
              <PhotoInput onFile={(f) => addPhoto(step.index, f)} variant="ghost">
                Choose photo
              </PhotoInput>
              <PhotoInput capture onFile={(f) => addPhoto(step.index, f)} grow>
                📷 Take photo
              </PhotoInput>
            </>
          )
        }
      >
        <p className="text-sm text-muted">
          Photo {step.index + 1} of {prompts.length}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{prompt.title}</h1>
        <p className="mb-4 mt-1.5 text-[15px] text-muted">{prompt.hint}</p>
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={photo.url} alt={prompt.title} className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
            <div
              role="status"
              className={`mt-3 rounded-xl p-3 text-[15px] font-semibold ${
                photo.reading ? "bg-ok-soft text-ok" : "bg-chip text-muted"
              }`}
            >
              {photo.reading ? `✓ We read: ${photo.reading.summary}` : "Checking your photo…"}
            </div>
            <UploadStatus
              upload={photo.upload}
              onRetry={(failed) => {
                setUpload(step.index, photo.url, { status: "uploading", progress: 0 });
                void savePhoto(step.index, photo.url, failed.file, failed.replaces);
              }}
            />
          </>
        ) : (
          <>
            <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border-2 border-dashed border-line bg-chip text-center text-muted">
              <span>
                <span className="block text-4xl">📷</span>
                Your photo will show here
              </span>
            </div>
            <button type="button" onClick={next} className="mt-4 font-bold text-accent-strong">
              I can’t get this photo
            </button>
          </>
        )}
      </Screen>
    );
  }

  if (step.kind === "reading") {
    const steps = analysis?.steps ?? [];
    const ready = analysis && readCount >= steps.length;
    return (
      <Screen
        embedded={embedded}
        action={
          <Primary disabled={!ready} onClick={() => setStep({ kind: "question", index: 0 })}>
            {ready ? "Answer a few quick questions" : "Almost ready…"}
          </Primary>
        }
      >
        <h1 className="mt-2 font-display text-2xl font-bold">Looking at your photos…</h1>
        <p className="mb-3 mt-1.5 text-[15px] text-muted">A few seconds. {firstName} will see everything you sent.</p>
        <ul aria-live="polite">
          {(steps.length ? steps : [{ label: "Your photos", result: "" }]).map((s, i) => {
            const done = i < readCount;
            const active = i === readCount;
            return (
              <li key={s.label} className="flex items-start gap-3 border-b border-line py-3">
                <span
                  className={`grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${
                    done
                      ? "bg-accent text-accent-ink"
                      : active
                        ? "animate-spin border-[3px] border-line border-t-accent-strong"
                        : "bg-chip"
                  }`}
                >
                  {done ? "✓" : ""}
                </span>
                <div>
                  <b>{s.label}</b>
                  <p className="text-sm text-muted">{done ? s.result : "…"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Screen>
    );
  }

  if (step.kind === "question") {
    const q = questions[step.index];
    if (!q) return <p className="p-6 text-muted">Loading questions…</p>;
    const answer = answers[q.id];
    const danger = q.dangerAnswer && answer === q.dangerAnswer;
    return (
      <Screen
        embedded={embedded}
        back={() => setStep(step.index === 0 ? { kind: "photo", index: prompts.length - 1 } : { kind: "question", index: step.index - 1 })}
        backLabel="Back"
        corner="Almost done"
        action={
          <Primary
            onClick={() =>
              setStep(step.index + 1 < questions.length ? { kind: "question", index: step.index + 1 } : { kind: "describe" })
            }
          >
            {answer ? "Next" : "Skip"}
          </Primary>
        }
      >
        <Because>{q.because}</Because>
        <QuestionBody q={q} answer={answer} onAnswer={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        {danger ? (
          <div role="alert" className="mt-2 rounded-xl bg-danger-soft p-3 text-[15px] font-semibold text-danger">
            ⚠ Turn the system off at the thermostat and stay away from the unit. If you see smoke or flames, call
            911. We’ll mark this as urgent for {firstName}.
          </div>
        ) : null}
      </Screen>
    );
  }

  if (step.kind === "describe") {
    return (
      <Screen
        embedded={embedded}
        back={() => setStep({ kind: "question", index: Math.max(questions.length - 1, 0) })}
        corner="Last one, optional"
        action={<Primary onClick={() => setStep({ kind: "review" })}>Review and send</Primary>}
      >
        <h1 className="font-display text-2xl font-bold leading-tight">Anything else {firstName} should know?</h1>
        <p className="mb-3 mt-1.5 text-[15px] text-muted">In your own words. Your keyboard’s mic works here too.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. It stopped after the heat wave"
          className="min-h-28 w-full rounded-xl border-[1.5px] border-line bg-white p-3 text-base"
        />
      </Screen>
    );
  }

  if (step.kind === "review") {
    return (
      <Screen
        embedded={embedded}
        back={() => setStep({ kind: "describe" })}
        action={<Primary onClick={() => setStep({ kind: "done" })}>Send to {firstName}</Primary>}
      >
        <h1 className="mt-2 font-display text-2xl font-bold">Look right?</h1>
        <p className="mb-3 mt-1.5 text-[15px] text-muted">Tap anything to change it.</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {photos.map((p, i) =>
            p ? (
              <button key={i} type="button" onClick={() => setStep({ kind: "photo", index: i })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={p.url} alt={prompts[i].title} className="aspect-[4/3] w-full rounded-xl border border-line object-cover" />
              </button>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setStep({ kind: "photo", index: i })}
                className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line bg-chip text-sm text-muted"
              >
                No photo · add
              </button>
            ),
          )}
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 text-[15px]">
          {questions.map((q, i) => (
            <ReviewRow key={q.id} label={q.short} value={answers[q.id] ?? "Skipped"} onClick={() => setStep({ kind: "question", index: i })} />
          ))}
          <ReviewRow label="Anything else" value={note ? `“${note}”` : "Nothing added"} onClick={() => setStep({ kind: "describe" })} />
        </div>
      </Screen>
    );
  }

  return (
    <Screen embedded={embedded}>
      <div className="pt-8 text-center">
        <div className="mx-auto grid h-19 w-19 place-items-center rounded-full bg-ok-soft text-4xl text-ok">✓</div>
        <h1 className="mt-4 font-display text-[28px] font-bold">Sent to {firstName}</h1>
        <p className="mt-1 text-muted">
          They’ll be in touch{businessPhone ? ` from ${businessPhone}` : ""} to set a time.
        </p>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-white p-4">
        <span className="text-[11.5px] font-bold uppercase tracking-widest text-muted">What happens next</span>
        <p className="mt-1.5">{firstName} reviews your photos and brings the likely part, so it can be one visit.</p>
      </div>
      <p className="mt-4 text-center text-sm text-muted">You can close this page.</p>
    </Screen>
  );
}

/* ---------- pieces ---------- */

function Screen({
  children,
  action,
  embedded,
  back,
  backLabel = "← Back",
  corner,
}: {
  children: ReactNode;
  action?: ReactNode;
  back?: () => void;
  backLabel?: string;
  corner?: string;
  embedded?: boolean;
}) {
  return (
    <div className={`flex flex-col bg-page text-[17px] text-ink ${embedded ? "min-h-[640px] rounded-lg" : "min-h-dvh"}`}>
      <div className="mx-auto w-full max-w-[520px] flex-1 px-5 pb-6 pt-5">
        {back || corner ? (
          <div className="mb-3 flex items-center justify-between">
            {back ? (
              <button type="button" onClick={back} className="font-bold text-accent-strong">
                {backLabel.startsWith("←") ? backLabel : `← ${backLabel}`}
              </button>
            ) : (
              <span />
            )}
            {corner ? <span className="text-sm text-muted">{corner}</span> : null}
          </div>
        ) : null}
        {children}
      </div>
      {action ? (
        <div className="sticky bottom-0 border-t border-line bg-page">
          <div className="mx-auto flex w-full max-w-[520px] gap-2 px-5 pb-5 pt-3">{action}</div>
        </div>
      ) : null}
    </div>
  );
}

const buttonBase =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-40";

function Primary({
  children,
  onClick,
  disabled,
  grow = true,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  grow?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${buttonBase} bg-accent text-accent-ink ${grow ? "flex-[2]" : ""}`}>
      {children}
    </button>
  );
}

function PhotoInput({
  children,
  onFile,
  capture,
  variant = "primary",
  grow,
  disabled,
}: {
  children: ReactNode;
  onFile: (file: File) => void;
  capture?: boolean;
  variant?: "primary" | "ghost";
  grow?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      aria-disabled={disabled}
      className={`${buttonBase} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${grow ? "flex-[2]" : "flex-1"} ${
        variant === "primary" ? "bg-accent text-accent-ink" : "border-[1.5px] border-line bg-white"
      }`}
    >
      {children}
      <input
        type="file"
        disabled={disabled}
        // JPEG first so iOS Safari converts HEIC (see docs/design/research).
        accept="image/jpeg,image/png,image/webp,image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

// Upload progress for live links. Previews and the demo show nothing.
function UploadStatus({
  upload,
  onRetry,
}: {
  upload: PhotoUpload;
  onRetry: (failed: Extract<PhotoUpload, { status: "failed" }>) => void;
}) {
  if (upload.status === "local") return null;
  if (upload.status === "saved") {
    return <p className="mt-2 text-sm text-muted">Photo saved</p>;
  }
  if (upload.status === "uploading") {
    const percent = Math.round(upload.progress * 100);
    return (
      <div className="mt-2" aria-live="polite">
        <p className="text-sm text-muted">{percent < 100 ? `Saving photo… ${percent}%` : "Saving photo…"}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chip">
          <div className="h-full bg-accent-strong transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-danger-soft p-3 text-[15px] text-danger">
      <span>{upload.error}</span>
      {upload.retryable ? (
        <button type="button" onClick={() => onRetry(upload)} className="shrink-0 font-bold underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

// XMLHttpRequest rather than fetch, which can't report upload progress.
function uploadPhoto(
  token: string,
  file: File,
  promptId: string,
  replaces: string | null,
  onProgress: (progress: number) => void,
): Promise<{ ok: true; photo: IntakePhoto } | { ok: false; error: string; retryable: boolean }> {
  const failed = { ok: false as const, error: "Your photo didn’t save. Check your connection.", retryable: true };
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/i/${token}/photos`);
    xhr.setRequestHeader("X-Intake-Upload", "1");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const body = xhr.response as { photo?: IntakePhoto; error?: string } | null;
      if (xhr.status === 200 && body?.photo) resolve({ ok: true, photo: body.photo });
      // 4xx: the photo or link was rejected; retrying won't help.
      else if (xhr.status >= 400 && xhr.status < 500 && body?.error) resolve({ ok: false, error: body.error, retryable: false });
      else resolve(failed);
    };
    xhr.onerror = () => resolve(failed);

    const form = new FormData();
    form.append("photo", file);
    form.append("prompt", promptId);
    if (replaces) form.append("replaces", replaces);
    xhr.send(form);
  });
}

function QuestionBody({
  q,
  answer,
  onAnswer,
}: {
  q: IntakeQuestion;
  answer?: string;
  onAnswer: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="font-display text-2xl font-bold leading-tight">{q.prompt}</legend>
      {q.help ? <p className="mb-4 mt-1.5 text-[15px] text-muted">{q.help}</p> : <div className="mb-4" />}
      <div className="flex flex-col gap-2.5">
        {q.options.map((option) => {
          const selected = answer === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onAnswer(option)}
              className={`flex min-h-[58px] items-center justify-between rounded-2xl border-[1.5px] px-4 text-left font-semibold ${
                selected ? "border-accent-strong bg-accent-soft" : "border-line bg-white"
              }`}
            >
              {option}
              {selected ? <span className="font-extrabold text-accent-strong">✓</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Because({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 flex gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
      <span aria-hidden>💡</span>
      <span>{children}</span>
    </p>
  );
}

function Effort({ big, label }: { big: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <b className="block font-display text-2xl">{big}</b>
      {label}
    </div>
  );
}

function ReviewRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full justify-between gap-3 border-t border-line py-3 text-left first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </button>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
