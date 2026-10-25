"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/ui/form-styles";
import { analyzeIntake } from "@/lib/intake-demo";
import {
  INTAKE_CAPTION_MAX_LENGTH,
  INTAKE_DESCRIPTION_MAX_LENGTH,
  INTAKE_PHOTO_MAX_BYTES,
  INTAKE_PHOTO_MAX_COUNT,
  INTAKE_PHOTO_MIN_COUNT,
  type IntakePhoto,
} from "@/lib/intake-photo-rules";
import type { IntakeAnalysis, IntakeAnswers, IntakeQuestion } from "@/lib/intake-types";
import {
  captionPhotoAction,
  removePhotoAction,
  rotatePhotoAction,
  saveDescriptionAction,
} from "./[token]/actions";

// Where a photo is in being saved. "local" photos (preview, demo) are never uploaded.
type PhotoUpload =
  | { status: "local" }
  | { status: "uploading"; progress: number }
  | { status: "saved"; id: string }
  | { status: "failed"; error: string; retryable: boolean; file: File; replaces: string | null };
type Photo = {
  /** Stable React key; survives replacing the photo. */
  key: string;
  url: string;
  caption: string;
  /** The caption the server has, to skip no-op saves. */
  savedCaption: string;
  upload: PhotoUpload;
  /** Local-only rotation for previews; live photos are rotated on the server. */
  rotation: number;
  busy: "rotating" | "removing" | null;
  error: string | null;
};
type Step =
  | { kind: "welcome" }
  | { kind: "photos" }
  | { kind: "no-photo" }
  | { kind: "reading" }
  | { kind: "question"; index: number }
  | { kind: "note" }
  | { kind: "review" }
  | { kind: "done" };

// Photo-first customer intake: 1–5 photos (or a description if no photo is
// possible) → "looking at your photos" → questions → review → sent.
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
  /** A real intake link: photos upload as they're added and are restored on reload. */
  live?: { token: string; photos: IntakePhoto[]; description: string };
}) {
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (live?.photos ?? []).map((saved) => ({
      key: saved.id,
      url: saved.thumbnailUrl,
      caption: saved.caption,
      savedCaption: saved.caption,
      upload: { status: "saved", id: saved.id },
      rotation: 0,
      busy: null,
      error: null,
    })),
  );
  const [description, setDescription] = useState(live?.description ?? "");
  const [notice, setNotice] = useState<string | null>(null);
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

  // Uploads run one at a time so several photos picked at once don't
  // compete for a phone's connection.
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
  // Latest typed caption per photo, read when an upload finishes.
  const latestCaption = useRef(new Map<string, string>());

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
  const savedCount = photos.filter((p) => p.upload.status === "saved" || p.upload.status === "local").length;
  const pending = photos.some((p) => p.upload.status === "uploading" || p.busy);
  const failedCount = photos.filter((p) => p.upload.status === "failed").length;
  const canContinue = savedCount >= INTAKE_PHOTO_MIN_COUNT && !pending && failedCount === 0;

  function goToReading() {
    setReadCount(0);
    setStep({ kind: "reading" });
  }

  function updatePhoto(key: string, change: Partial<Photo> | ((photo: Photo) => Partial<Photo>)) {
    setPhotos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...(typeof change === "function" ? change(p) : change) } : p)),
    );
  }

  // Ignores progress from an upload that was since replaced.
  function setUpload(key: string, url: string, upload: PhotoUpload) {
    setPhotos((prev) => prev.map((p) => (p.key === key && p.url === url ? { ...p, upload } : p)));
  }

  async function saveCaption(key: string, photoId: string, caption: string) {
    if (!live) return;
    const result = await captionPhotoAction(live.token, photoId, caption);
    updatePhoto(key, result.ok ? { savedCaption: caption, error: null } : { error: result.error });
  }

  // Network failures retry automatically before asking the customer.
  async function savePhoto(key: string, url: string, file: File, replaces: string | null) {
    if (!live) return;
    for (let attempt = 0; ; attempt++) {
      setUpload(key, url, { status: "uploading", progress: 0 });
      const result = await uploadPhoto(live.token, file, replaces, (progress) =>
        setUpload(key, url, { status: "uploading", progress }),
      );
      if (result.ok) {
        setUpload(key, url, { status: "saved", id: result.photo.id });
        // A caption typed while the photo was uploading (or kept from a
        // replaced photo) is saved onto the new one.
        const typed = latestCaption.current.get(key)?.trim();
        if (typed) void saveCaption(key, result.photo.id, typed);
        else updatePhoto(key, { savedCaption: "" });
        return;
      }
      if (!result.retryable || attempt >= 2) {
        setUpload(key, url, { status: "failed", error: result.error, retryable: result.retryable, file, replaces });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }

  function queueUpload(key: string, url: string, file: File, replaces: string | null) {
    uploadQueue.current = uploadQueue.current.then(() => savePhoto(key, url, file, replaces));
  }

  function initialUpload(file: File, replaces: string | null): PhotoUpload {
    if (!live) return { status: "local" };
    if (file.size > INTAKE_PHOTO_MAX_BYTES) {
      return {
        status: "failed",
        error: "This photo is larger than 10 MB. Retake it or choose a smaller one.",
        retryable: false,
        file,
        replaces,
      };
    }
    return { status: "uploading", progress: 0 };
  }

  function addPhotos(files: File[]) {
    setNotice(null);
    const room = INTAKE_PHOTO_MAX_COUNT - photos.length;
    if (files.length > room) {
      setNotice(`You can add up to ${INTAKE_PHOTO_MAX_COUNT} photos, so only the first ${room} were added.`);
    }
    const added = files.slice(0, Math.max(room, 0)).map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      const photo: Photo = {
        key: crypto.randomUUID(),
        url,
        caption: "",
        savedCaption: "",
        upload: initialUpload(file, null),
        rotation: 0,
        busy: null,
        error: null,
      };
      return { file, photo };
    });
    setPhotos((prev) => [...prev, ...added.map((a) => a.photo)]);
    for (const { file, photo } of added) {
      if (photo.upload.status === "uploading") queueUpload(photo.key, photo.url, file, null);
    }
  }

  // Replaces a photo in place. A saved photo is swapped on the server only
  // once the new one is stored, so a failed upload never loses the old one.
  function replacePhoto(photo: Photo, file: File) {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const replaces =
      photo.upload.status === "saved"
        ? photo.upload.id
        : photo.upload.status === "failed"
          ? photo.upload.replaces
          : null;
    const upload = initialUpload(file, replaces);
    latestCaption.current.set(photo.key, photo.caption);
    updatePhoto(photo.key, { url, upload, rotation: 0, error: null });
    if (upload.status === "uploading") queueUpload(photo.key, url, file, replaces);
  }

  async function removePhoto(photo: Photo) {
    if (live && photo.upload.status === "saved") {
      updatePhoto(photo.key, { busy: "removing", error: null });
      const result = await removePhotoAction(live.token, photo.upload.id);
      if (!result.ok) {
        updatePhoto(photo.key, { busy: null, error: result.error });
        return;
      }
    }
    // Failed uploads were already cleaned up on the server.
    setPhotos((prev) => prev.filter((p) => p.key !== photo.key));
    setNotice(null);
  }

  async function rotatePhoto(photo: Photo) {
    if (!live) {
      updatePhoto(photo.key, (p) => ({ rotation: (p.rotation + 90) % 360 }));
      return;
    }
    if (photo.upload.status !== "saved") return;
    updatePhoto(photo.key, { busy: "rotating", error: null });
    const result = await rotatePhotoAction(live.token, photo.upload.id);
    updatePhoto(
      photo.key,
      result.ok ? { busy: null, url: result.thumbnailUrl } : { busy: null, error: result.error },
    );
  }

  function commitCaption(photo: Photo) {
    const caption = photo.caption.trim();
    if (photo.upload.status === "saved" && caption !== photo.savedCaption) {
      void saveCaption(photo.key, photo.upload.id, caption);
    }
  }

  if (step.kind === "welcome") {
    return (
      <Screen
        embedded={embedded}
        action={<Primary onClick={() => setStep({ kind: "photos" })}>Start with a photo</Primary>}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-600">{businessName}</p>
          {businessPhone ? <p className="text-sm text-neutral-500">{businessPhone}</p> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {customerName}, show us the problem</h1>
        <p className="text-base leading-7 text-neutral-700">
          {businessName} asked for a photo of the problem and a few quick answers so they can bring the right parts.
          It takes about two minutes.
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          No app or account needed. Only {businessName} sees your photos. We’ll never ask you to open covers or touch
          wiring. Submitting doesn’t book an appointment.
        </p>
      </Screen>
    );
  }

  if (step.kind === "photos") {
    const full = photos.length >= INTAKE_PHOTO_MAX_COUNT;
    const blocker = pending
      ? "Wait for your photos to finish saving."
      : failedCount > 0
        ? "Try again or remove the photo that didn’t save."
        : null;
    return (
      <Screen
        embedded={embedded}
        back={() => setStep({ kind: "welcome" })}
        action={
          photos.length > 0 ? (
            <>
              <Primary onClick={goToReading} disabled={!canContinue}>
                Continue
              </Primary>
              {blocker ? <p className="text-sm text-neutral-500">{blocker}</p> : null}
            </>
          ) : (
            <button type="button" onClick={() => setStep({ kind: "no-photo" })} className="self-start text-sm underline">
              I can’t take a photo
            </button>
          )
        }
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Take a photo of the problem</h1>
          <ul className="list-disc space-y-1 pl-5 text-base leading-7 text-neutral-700">
            <li>Start with the whole thing that isn’t working, like the appliance, fixture, or area.</li>
            <li>Add close-ups of anything leaking, broken, burnt, or showing an error.</li>
            <li>A sticker with the brand or model helps, if it’s easy to see. Don’t open covers.</li>
          </ul>
          <p className="text-sm text-neutral-500">
            At least 1 photo, up to {INTAKE_PHOTO_MAX_COUNT}. {photos.length} added.
          </p>
        </div>

        {photos.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {photos.map((photo, index) => (
              <PhotoCard
                key={photo.key}
                photo={photo}
                index={index}
                canRotate={!live || photo.upload.status === "saved"}
                onCaption={(caption) => {
                  latestCaption.current.set(photo.key, caption);
                  updatePhoto(photo.key, { caption });
                }}
                onCaptionDone={() => commitCaption(photo)}
                onRotate={() => void rotatePhoto(photo)}
                onReplace={(file) => replacePhoto(photo, file)}
                onRemove={() => void removePhoto(photo)}
                onRetry={(failed) => {
                  setUpload(photo.key, photo.url, { status: "uploading", progress: 0 });
                  queueUpload(photo.key, photo.url, failed.file, failed.replaces);
                }}
              />
            ))}
          </ul>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
            Your photos will show here
          </div>
        )}

        {notice ? (
          <p role="status" className="text-sm text-neutral-700">
            {notice}
          </p>
        ) : null}

        {full ? (
          <p className="text-sm text-neutral-500">That’s the most photos you can add. Remove one to add another.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <PhotoInput capture onFiles={addPhotos} variant={photos.length === 0 ? "primary" : "secondary"}>
              {photos.length === 0 ? "Take a photo" : "Take another photo"}
            </PhotoInput>
            <PhotoInput multiple onFiles={addPhotos} variant="secondary">
              {photos.length === 0 ? "Upload a photo" : "Upload another photo"}
            </PhotoInput>
          </div>
        )}
      </Screen>
    );
  }

  if (step.kind === "no-photo") {
    return (
      <NoPhotoStep
        embedded={embedded}
        initial={description}
        onBack={() => setStep({ kind: "photos" })}
        onSave={async (text) => {
          if (live) {
            const result = await saveDescriptionAction(live.token, text);
            if (!result.ok) return result.error;
          }
          setDescription(text);
          goToReading();
          return null;
        }}
      />
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
          <h1 className="text-2xl font-semibold tracking-tight">
            {savedCount > 0 ? "Looking at your photos…" : "Reading your description…"}
          </h1>
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
        back={() =>
          setStep(
            step.index > 0
              ? { kind: "question", index: step.index - 1 }
              : savedCount > 0
                ? { kind: "photos" }
                : { kind: "no-photo" },
          )
        }
        action={
          <Primary
            onClick={() =>
              setStep(step.index + 1 < questions.length ? { kind: "question", index: step.index + 1 } : { kind: "note" })
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

  if (step.kind === "note") {
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
        back={() => setStep({ kind: "note" })}
        action={<Primary onClick={() => setStep({ kind: "done" })}>Send to {firstName}</Primary>}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Look right?</h1>
          <p className="text-base leading-7 text-neutral-700">Tap anything to change it.</p>
        </div>
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo, index) => (
              <button
                key={photo.key}
                type="button"
                onClick={() => setStep({ kind: "photos" })}
                className="space-y-1 text-left"
              >
                <PhotoImage photo={photo} alt={photo.caption || `Photo ${index + 1}`} />
                {photo.caption ? <span className="block truncate text-sm text-neutral-600">{photo.caption}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {savedCount === 0 ? (
            <ReviewRow
              label="Your description"
              value={description ? `“${description}”` : "Nothing added"}
              onClick={() => setStep({ kind: "no-photo" })}
            />
          ) : null}
          {questions.map((q, i) => (
            <ReviewRow key={q.id} label={q.short} value={answers[q.id] ?? "Skipped"} onClick={() => setStep({ kind: "question", index: i })} />
          ))}
          <ReviewRow label="Anything else" value={note ? `“${note}”` : "Nothing added"} onClick={() => setStep({ kind: "note" })} />
        </div>
      </Screen>
    );
  }

  return (
    <Screen embedded={embedded}>
      <h1 className="text-2xl font-semibold tracking-tight">Sent to {firstName}</h1>
      <p className="text-base leading-7 text-neutral-700">
        They’ll be in touch{businessPhone ? ` from ${businessPhone}` : ""} to set a time. {firstName} reviews what you
        sent first so they can bring the likely part.
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
  onFiles,
  capture,
  multiple,
  variant = "primary",
  disabled,
  compact,
}: {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  capture?: boolean;
  multiple?: boolean;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  /** A small text-style control, for photo card actions. */
  compact?: boolean;
}) {
  const className = compact
    ? "text-sm underline"
    : variant === "primary"
      ? primaryButtonClassName
      : secondaryButtonClassName;
  return (
    <label
      aria-disabled={disabled}
      className={`${className} ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-900/30`}
    >
      {children}
      <input
        type="file"
        disabled={disabled}
        multiple={multiple}
        // JPEG first so iOS Safari converts HEIC (see docs/design/research).
        accept="image/jpeg,image/png,image/webp,image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function PhotoImage({ photo, alt }: { photo: Photo; alt: string }) {
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob or short-lived signed URL */}
      <img
        src={photo.url}
        alt={alt}
        style={photo.rotation ? { transform: `rotate(${photo.rotation}deg)` } : undefined}
        className="size-full object-contain"
      />
    </div>
  );
}

function PhotoCard({
  photo,
  index,
  canRotate,
  onCaption,
  onCaptionDone,
  onRotate,
  onReplace,
  onRemove,
  onRetry,
}: {
  photo: Photo;
  index: number;
  canRotate: boolean;
  onCaption: (caption: string) => void;
  onCaptionDone: () => void;
  onRotate: () => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
  onRetry: (failed: Extract<PhotoUpload, { status: "failed" }>) => void;
}) {
  const label = `Photo ${index + 1}`;
  const busy = photo.busy !== null || photo.upload.status === "uploading";
  const actionClassName = "text-sm underline disabled:no-underline disabled:opacity-50";
  return (
    <li className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3">
      <PhotoImage photo={photo} alt={photo.caption || label} />
      <UploadStatus upload={photo.upload} onRetry={onRetry} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`caption-${photo.key}`} className="text-sm font-medium">
          What does this show? <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <input
          id={`caption-${photo.key}`}
          type="text"
          value={photo.caption}
          maxLength={INTAKE_CAPTION_MAX_LENGTH}
          placeholder="e.g. Water under the sink"
          onChange={(e) => onCaption(e.target.value)}
          onBlur={onCaptionDone}
          className={inputClassName}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-medium text-neutral-700">{label}</span>
        <button type="button" onClick={onRotate} disabled={!canRotate || busy} className={actionClassName}>
          {photo.busy === "rotating" ? "Rotating…" : "Rotate"}
        </button>
        <PhotoInput compact onFiles={(files) => onReplace(files[0])} disabled={busy}>
          Replace
        </PhotoInput>
        <button type="button" onClick={onRemove} disabled={busy} className={actionClassName}>
          {photo.busy === "removing" ? "Removing…" : "Remove"}
        </button>
      </div>
      {photo.error ? (
        <p role="alert" className="text-sm text-red-700">
          {photo.error}
        </p>
      ) : null}
    </li>
  );
}

function NoPhotoStep({
  embedded,
  initial,
  onBack,
  onSave,
}: {
  embedded: boolean;
  initial: string;
  onBack: () => void;
  /** Returns an error message, or null on success. */
  onSave: (description: string) => Promise<string | null>;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Screen
      embedded={embedded}
      back={onBack}
      action={
        <Primary
          disabled={saving}
          onClick={async () => {
            if (!text.trim()) {
              setError("Describe the problem so they know what to expect.");
              return;
            }
            setSaving(true);
            const failure = await onSave(text.trim());
            setSaving(false);
            setError(failure);
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </Primary>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="no-photo-description" className="text-2xl font-semibold tracking-tight">
          Tell us what’s wrong
        </label>
        <p className="text-base leading-7 text-neutral-700">
          No problem if you can’t take a photo. Describe what you see, hear, or smell, where it is, and when it
          started.
        </p>
      </div>
      <textarea
        id="no-photo-description"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        rows={6}
        maxLength={INTAKE_DESCRIPTION_MAX_LENGTH}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "no-photo-error" : undefined}
        placeholder="e.g. The kitchen sink drains slowly and there’s water in the cabinet underneath. Started yesterday."
        className={`${inputClassName} h-auto py-2`}
      />
      {error ? (
        <p id="no-photo-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={onBack} className="self-start text-sm underline">
        Add a photo instead
      </button>
    </Screen>
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
