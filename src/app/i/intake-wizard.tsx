"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";
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
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-600">{businessName}</p>
          {businessPhone ? <p className="text-sm text-neutral-500">{businessPhone}</p> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {customerName}, show us the problem</h1>
        <p className="text-base leading-7 text-neutral-700">
          {businessName} asked for {prompts.length} photos and a few quick answers so they can bring the right parts.
          It takes about 90 seconds.
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          No app or account needed. Only {businessName} sees your photos. We’ll never ask you to open covers or touch
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
                variant="secondary"
                disabled={photo.upload.status === "uploading"}
              >
                Retake
              </PhotoInput>
              <Primary onClick={next} disabled={!photo.reading || unusable}>
                {photo.reading ? (isLast ? "Done with photos" : "Next photo") : "Checking…"}
              </Primary>
            </>
          ) : (
            <>
              <PhotoInput capture onFile={(f) => addPhoto(step.index, f)}>
                Take a photo
              </PhotoInput>
              <PhotoInput onFile={(f) => addPhoto(step.index, f)} variant="secondary">
                Upload a photo
              </PhotoInput>
            </>
          )
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">
            Photo {step.index + 1} of {prompts.length}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{prompt.title}</h1>
          <p className="text-base leading-7 text-neutral-700">{prompt.hint}</p>
        </div>
        {photo ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={photo.url} alt={prompt.title} className="aspect-[4/3] w-full rounded-md border border-neutral-200 object-cover" />
            <p role="status" className={statusClassName}>
              {photo.reading ? `We read: ${photo.reading.summary}` : "Checking your photo…"}
            </p>
            <UploadStatus
              upload={photo.upload}
              onRetry={(failed) => {
                setUpload(step.index, photo.url, { status: "uploading", progress: 0 });
                void savePhoto(step.index, photo.url, failed.file, failed.replaces);
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
              Your photo will show here
            </div>
            <button type="button" onClick={next} className="text-sm underline">
              I can’t get this photo
            </button>
          </div>
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
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Looking at your photos…</h1>
          <p className="text-base leading-7 text-neutral-700">A few seconds. {firstName} will see everything you sent.</p>
        </div>
        <ul aria-live="polite" className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {(steps.length ? steps : [{ label: "Your photos", result: "" }]).map((s, i) => {
            const done = i < readCount;
            return (
              <li key={s.label} className="px-4 py-3">
                <p className="text-sm font-medium">
                  {s.label}
                  <span className="ml-2 font-normal text-neutral-500">{done ? "Done" : "Checking…"}</span>
                </p>
                {done && s.result ? <p className="text-sm text-neutral-600">{s.result}</p> : null}
              </li>
            );
          })}
        </ul>
      </Screen>
    );
  }

  if (step.kind === "question") {
    const q = questions[step.index];
    if (!q) return <p className="p-6 text-sm text-neutral-500">Loading questions…</p>;
    const answer = answers[q.id];
    const danger = q.dangerAnswer && answer === q.dangerAnswer;
    return (
      <Screen
        embedded={embedded}
        back={() => setStep(step.index === 0 ? { kind: "photo", index: prompts.length - 1 } : { kind: "question", index: step.index - 1 })}
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
        <p className="text-sm text-neutral-500">{q.because}</p>
        <QuestionBody q={q} answer={answer} onAnswer={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        {danger ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            Turn the system off at the thermostat and stay away from the unit. If you see smoke or flames, call 911.
            We’ll mark this as urgent for {firstName}.
          </p>
        ) : null}
      </Screen>
    );
  }

  if (step.kind === "describe") {
    return (
      <Screen
        embedded={embedded}
        back={() => setStep({ kind: "question", index: Math.max(questions.length - 1, 0) })}
        action={<Primary onClick={() => setStep({ kind: "review" })}>Review and send</Primary>}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="intake-note" className="text-2xl font-semibold tracking-tight">
            Anything else {firstName} should know?
          </label>
          <p className="text-base leading-7 text-neutral-700">Optional. In your own words.</p>
        </div>
        <textarea
          id="intake-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="e.g. It stopped after the heat wave"
          className={`${inputClassName} h-auto py-2`}
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
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Look right?</h1>
          <p className="text-base leading-7 text-neutral-700">Tap anything to change it.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p, i) =>
            p ? (
              <button key={i} type="button" onClick={() => setStep({ kind: "photo", index: i })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={p.url} alt={prompts[i].title} className="aspect-[4/3] w-full rounded-md border border-neutral-200 object-cover" />
              </button>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => setStep({ kind: "photo", index: i })}
                className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500"
              >
                No photo · add
              </button>
            ),
          )}
        </div>
        <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
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
      <h1 className="text-2xl font-semibold tracking-tight">Sent to {firstName}</h1>
      <p className="text-base leading-7 text-neutral-700">
        They’ll be in touch{businessPhone ? ` from ${businessPhone}` : ""} to set a time. {firstName} reviews your
        photos first so they can bring the likely part.
      </p>
      <p className="text-sm text-neutral-500">You can close this page.</p>
    </Screen>
  );
}

/* ---------- pieces ---------- */

// Same plain layout as the rest of the app: one centered column, actions
// below the content.
function Screen({
  children,
  action,
  embedded,
  back,
}: {
  children: ReactNode;
  action?: ReactNode;
  back?: () => void;
  embedded?: boolean;
}) {
  return (
    <div className={`bg-white text-neutral-950 ${embedded ? "rounded-lg p-6" : "min-h-dvh px-6 py-10"}`}>
      <div className={`mx-auto flex w-full max-w-md flex-col gap-6 ${embedded ? "" : "min-h-[calc(100dvh-5rem)] justify-center"}`}>
        {back ? (
          <button type="button" onClick={back} className="self-start text-sm text-neutral-600 underline">
            ← Back
          </button>
        ) : null}
        {children}
        {action ? <div className="flex flex-col gap-3">{action}</div> : null}
      </div>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={primaryButtonClassName}>
      {children}
    </button>
  );
}

function PhotoInput({
  children,
  onFile,
  capture,
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onFile: (file: File) => void;
  capture?: boolean;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <label
      aria-disabled={disabled}
      className={`${variant === "primary" ? primaryButtonClassName : secondaryButtonClassName} ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/30`}
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
    return <p className="text-sm text-neutral-500">Photo saved</p>;
  }
  if (upload.status === "uploading") {
    const percent = Math.round(upload.progress * 100);
    return (
      <div aria-live="polite" className="space-y-1">
        <p className="text-sm text-neutral-500">{percent < 100 ? `Saving photo… ${percent}%` : "Saving photo…"}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-neutral-900" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-center justify-between gap-3 text-sm text-red-700">
      <span>{upload.error}</span>
      {upload.retryable ? (
        <button type="button" onClick={() => onRetry(upload)} className="shrink-0 underline">
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
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-2xl font-semibold tracking-tight">{q.prompt}</legend>
      {q.help ? <p className="text-base leading-7 text-neutral-700">{q.help}</p> : null}
      <div className="flex flex-col gap-2">
        {q.options.map((option) => {
          const selected = answer === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onAnswer(option)}
              className={`flex h-11 items-center justify-between rounded-md border px-4 text-left text-sm font-medium ${
                selected ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 bg-white"
              }`}
            >
              {option}
              {selected ? <span aria-hidden>✓</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ReviewRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full justify-between gap-3 px-4 py-3 text-left text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </button>
  );
}
