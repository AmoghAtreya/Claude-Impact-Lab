"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fieldErrorClassName, inputClassName } from "@/app/ui/form-styles";
import {
  INTAKE_CAPTION_MAX_LENGTH,
  INTAKE_DESCRIPTION_MAX_LENGTH,
  INTAKE_PHOTO_ACCEPT,
  INTAKE_PHOTO_ACCEPTED_TYPES,
  INTAKE_PHOTO_MAX_BYTES,
  INTAKE_PHOTO_MAX_COUNT,
  type IntakePhoto,
  type IntakePhotoRotation,
} from "@/lib/intake-photo-rules";
import {
  removeIntakePhotoAction,
  saveIntakeDescriptionAction,
  updateIntakePhotoAction,
} from "./actions";

// "preview" lets contractors try the flow; nothing is uploaded or saved.
export type PhotoIntakeMode =
  | { kind: "live"; token: string }
  | { kind: "preview" };

type SavedPhoto = {
  id: string;
  url: string;
  caption: string;
  rotation: IntakePhotoRotation;
};

type Item = {
  key: string;
  // What the server has. Null until the first upload succeeds.
  saved: SavedPhoto | null;
  // A new photo or replacement that is uploading or failed. Failed uploads
  // keep the file so the customer can retry.
  upload: {
    file: File;
    url: string;
    started: boolean;
    progress: number;
    error: string | null;
  } | null;
  caption: string;
  captionStatus: "idle" | "saving" | "saved";
  busy: boolean;
  error: string | null;
};

type UploadResult =
  | { ok: true; photo: IntakePhoto }
  | { ok: false; error: string };

const UPLOAD_FAILED = "Upload failed. Check your connection and try again.";

const primaryClassName =
  "inline-flex h-12 items-center justify-center rounded-md bg-neutral-900 px-4 text-base font-medium text-white disabled:opacity-50";
const secondaryClassName =
  "inline-flex h-12 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-base font-medium disabled:opacity-50";
const smallButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium disabled:opacity-50";

export function PhotoIntake({
  mode,
  businessName,
  initialPhotos,
  initialDescription,
}: {
  mode: PhotoIntakeMode;
  businessName: string;
  initialPhotos: IntakePhoto[];
  initialDescription: string;
}) {
  const nextKey = useRef(0);
  const newKey = () => `new-${nextKey.current++}`;

  const [items, setItems] = useState<Item[]>(() =>
    initialPhotos.map((photo) => ({
      key: photo.id,
      saved: {
        id: photo.id,
        url: photo.thumbnailUrl,
        caption: photo.caption,
        rotation: photo.rotation,
      },
      upload: null,
      caption: photo.caption,
      captionStatus: "idle",
      busy: false,
      error: null,
    })),
  );
  const [notice, setNotice] = useState<string | null>(null);
  // Uploads finish after later renders; read the latest items from here.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  // Local previews stay in memory until released.
  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const createPreviewUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    return url;
  };
  const releasePreviewUrl = (url: string | undefined) => {
    if (url && objectUrls.current.delete(url)) URL.revokeObjectURL(url);
  };

  const updateItem = (key: string, change: (item: Item) => Item) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? change(item) : item)),
    );
  const dropItem = (key: string) =>
    setItems((current) => current.filter((item) => item.key !== key));

  function checkFile(file: File) {
    if (file.type && !INTAKE_PHOTO_ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name} isn't a supported photo. Use a JPEG, PNG, or WebP photo.`;
    }
    if (file.size > INTAKE_PHOTO_MAX_BYTES) {
      return `${file.name} is larger than 10 MB. Choose a smaller photo.`;
    }
    return null;
  }

  async function startUpload(key: string, file: File, replacing: SavedPhoto | null) {
    updateItem(key, (item) =>
      item.upload ? { ...item, upload: { ...item.upload, started: true } } : item,
    );
    const onProgress = (progress: number) =>
      updateItem(key, (item) =>
        item.upload ? { ...item, upload: { ...item.upload, progress } } : item,
      );
    const result =
      mode.kind === "live"
        ? await uploadPhoto(mode.token, file, replacing, onProgress)
        : await simulateUpload(replacing, onProgress, newKey);

    if (result.ok) {
      // A replaced photo's preview is no longer shown.
      releasePreviewUrl(itemsRef.current.find((item) => item.key === key)?.saved?.url);
    }
    updateItem(key, (item) => {
      if (!item.upload) return item;
      if (!result.ok) {
        return { ...item, upload: { ...item.upload, error: result.error } };
      }
      // Keep showing the local preview; it's already loaded.
      return {
        ...item,
        saved: {
          id: result.photo.id,
          url: item.upload.url,
          caption: result.photo.caption,
          rotation: result.photo.rotation,
        },
        upload: null,
        caption: result.photo.caption,
        captionStatus: "idle",
        error: null,
      };
    });
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const messages: string[] = [];
    const available = INTAKE_PHOTO_MAX_COUNT - items.length;
    if (files.length > available) {
      messages.push(
        `You can add up to ${INTAKE_PHOTO_MAX_COUNT} photos, so only the first ${Math.max(available, 0)} were added.`,
      );
    }

    const added: Item[] = [];
    for (const file of files.slice(0, Math.max(available, 0))) {
      const problem = checkFile(file);
      if (problem) {
        messages.push(problem);
        continue;
      }
      added.push({
        key: newKey(),
        saved: null,
        upload: {
          file,
          url: createPreviewUrl(file),
          started: false,
          progress: 0,
          error: null,
        },
        caption: "",
        captionStatus: "idle",
        busy: false,
        error: null,
      });
    }

    setNotice(messages.length > 0 ? messages.join(" ") : null);
    setItems((current) => [...current, ...added]);
    // One at a time, so photos are saved in the order they were chosen.
    void (async () => {
      for (const item of added) {
        await startUpload(item.key, item.upload!.file, null);
      }
    })();
  }

  function replaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const item = items.find((candidate) => candidate.key === replaceTargetRef.current);
    if (!file || !item?.saved) return;

    const problem = checkFile(file);
    if (problem) {
      updateItem(item.key, (current) => ({ ...current, error: problem }));
      return;
    }
    updateItem(item.key, (current) => ({
      ...current,
      upload: {
          file,
          url: createPreviewUrl(file),
          started: false,
          progress: 0,
          error: null,
        },
      error: null,
    }));
    void startUpload(item.key, file, item.saved);
  }

  function retryUpload(item: Item) {
    if (!item.upload) return;
    updateItem(item.key, (current) => ({
      ...current,
      upload: current.upload && { ...current.upload, progress: 0, error: null },
    }));
    void startUpload(item.key, item.upload.file, item.saved);
  }

  // Abandons a failed upload. A failed replacement keeps the original photo.
  function cancelUpload(item: Item) {
    releasePreviewUrl(item.upload?.url);
    if (item.saved) {
      updateItem(item.key, (current) => ({ ...current, upload: null }));
    } else {
      dropItem(item.key);
    }
  }

  async function removePhoto(item: Item) {
    if (!item.saved) return;
    updateItem(item.key, (current) => ({ ...current, busy: true, error: null }));
    const result =
      mode.kind === "live"
        ? await removeIntakePhotoAction(mode.token, item.saved.id)
        : { ok: true as const };
    if (result.ok) {
      releasePreviewUrl(item.saved.url);
      dropItem(item.key);
    } else {
      updateItem(item.key, (current) => ({ ...current, busy: false, error: result.error }));
    }
  }

  async function rotatePhoto(item: Item) {
    const saved = item.saved;
    if (!saved) return;
    const rotation = ((saved.rotation + 90) % 360) as IntakePhotoRotation;
    updateItem(item.key, (current) => ({
      ...current,
      saved: current.saved && { ...current.saved, rotation },
      busy: true,
      error: null,
    }));
    const result =
      mode.kind === "live"
        ? await updateIntakePhotoAction(mode.token, saved.id, {
            caption: saved.caption,
            rotation,
          })
        : { ok: true as const };
    updateItem(item.key, (current) => ({
      ...current,
      saved:
        current.saved && !result.ok
          ? { ...current.saved, rotation: saved.rotation }
          : current.saved,
      busy: false,
      error: result.ok ? null : result.error,
    }));
  }

  async function saveCaption(item: Item) {
    const saved = item.saved;
    const caption = item.caption.trim();
    if (!saved || caption === saved.caption) return;
    updateItem(item.key, (current) => ({ ...current, captionStatus: "saving", error: null }));
    const result =
      mode.kind === "live"
        ? await updateIntakePhotoAction(mode.token, saved.id, {
            caption,
            rotation: saved.rotation,
          })
        : { ok: true as const };
    updateItem(item.key, (current) => ({
      ...current,
      saved: current.saved && result.ok ? { ...current.saved, caption } : current.saved,
      captionStatus: result.ok ? "saved" : "idle",
      error: result.ok ? null : result.error,
    }));
  }

  const atLimit = items.length >= INTAKE_PHOTO_MAX_COUNT;
  const uploading = items.some((item) => item.upload && !item.upload.error);
  const hasPhoto = items.some((item) => item.saved);

  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 ? (
        <div className="rounded-md bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
          <p className="font-medium text-neutral-900">What to photograph</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>The problem up close, like a leak, damage, or a message on a display</li>
            <li>The whole unit or area, so it&apos;s clear where the problem is</li>
            <li>Any label with a brand or model number, if you can reach it safely</li>
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Your photos">
          {items.map((item, index) => (
            <PhotoCard
              key={item.key}
              item={item}
              index={index}
              onCaptionChange={(caption) =>
                updateItem(item.key, (current) => ({
                  ...current,
                  caption,
                  captionStatus: "idle",
                }))
              }
              onCaptionBlur={() => saveCaption(item)}
              onRotate={() => rotatePhoto(item)}
              onReplace={() => {
                replaceTargetRef.current = item.key;
                replaceInputRef.current?.click();
              }}
              onRemove={() => removePhoto(item)}
              onRetry={() => retryUpload(item)}
              onCancel={() => cancelUpload(item)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className={items.length === 0 ? primaryClassName : secondaryClassName}
          disabled={atLimit}
          onClick={() => cameraInputRef.current?.click()}
        >
          {items.length === 0 ? "Take a photo" : "Take another photo"}
        </button>
        <button
          type="button"
          className={secondaryClassName}
          disabled={atLimit}
          onClick={() => libraryInputRef.current?.click()}
        >
          {items.length === 0 ? "Upload a photo" : "Upload more photos"}
        </button>
        <p className="text-sm text-neutral-500">
          {atLimit
            ? `You've added the maximum of ${INTAKE_PHOTO_MAX_COUNT} photos. Remove one to add another.`
            : `Up to ${INTAKE_PHOTO_MAX_COUNT} photos, 10 MB each.`}
        </p>
        <p role="status" className={notice ? fieldErrorClassName : "sr-only"}>
          {notice}
        </p>
      </div>

      {/* Camera opens directly on phones; elsewhere it falls back to a file picker. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={INTAKE_PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={addFiles}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept={INTAKE_PHOTO_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={addFiles}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={INTAKE_PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={replaceFile}
      />

      <DescriptionFallback
        mode={mode}
        businessName={businessName}
        initialDescription={initialDescription}
        hasPhotos={items.length > 0}
        canContinue={hasPhoto && !uploading}
      />
    </div>
  );
}

function PhotoCard({
  item,
  index,
  onCaptionChange,
  onCaptionBlur,
  onRotate,
  onReplace,
  onRemove,
  onRetry,
  onCancel,
}: {
  item: Item;
  index: number;
  onCaptionChange: (caption: string) => void;
  onCaptionBlur: () => void;
  onRotate: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const { saved, upload } = item;
  const imageUrl = upload?.url ?? saved?.url;
  const rotation = upload ? 0 : (saved?.rotation ?? 0);
  const captionId = `${item.key}-caption`;
  const percent = Math.round((upload?.progress ?? 0) * 100);
  const controlsDisabled = Boolean(upload) || item.busy;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      {/* Square, so a rotated photo still fits inside. */}
      <div className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL or local blob preview
          <img
            src={imageUrl}
            alt={saved?.caption || `Photo ${index + 1}`}
            className="size-full object-contain transition-transform"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        ) : null}
        {upload && !upload.error ? (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2">
            <p className="text-sm text-neutral-700" aria-live="polite">
              {!upload.started
                ? "Waiting to upload…"
                : percent < 100
                  ? `Uploading… ${percent}%`
                  : "Processing photo…"}
            </p>
            <progress
              value={upload.progress}
              max={1}
              aria-label={`Photo ${index + 1} upload progress`}
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-neutral-900 [&::-webkit-progress-bar]:bg-neutral-200 [&::-webkit-progress-value]:bg-neutral-900"
            />
          </div>
        ) : null}
      </div>

      {upload?.error ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className={fieldErrorClassName}>
            {upload.error}
          </p>
          <div className="flex gap-2">
            <button type="button" className={smallButtonClassName} onClick={onRetry}>
              Try again
            </button>
            <button type="button" className={smallButtonClassName} onClick={onCancel}>
              {saved ? "Keep original" : "Remove"}
            </button>
          </div>
        </div>
      ) : null}

      {saved ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={captionId} className="text-sm font-medium">
              What does this photo show?{" "}
              <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <input
              id={captionId}
              value={item.caption}
              maxLength={INTAKE_CAPTION_MAX_LENGTH}
              placeholder="e.g. Water under the indoor unit"
              disabled={controlsDisabled}
              onChange={(event) => onCaptionChange(event.target.value)}
              onBlur={onCaptionBlur}
              className={`${inputClassName} w-full`}
            />
            <p className="text-xs text-neutral-500" aria-live="polite">
              {item.captionStatus === "saving"
                ? "Saving…"
                : item.captionStatus === "saved"
                  ? "Saved"
                  : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={smallButtonClassName}
              disabled={controlsDisabled}
              onClick={onRotate}
              aria-label={`Rotate photo ${index + 1}`}
            >
              Rotate
            </button>
            <button
              type="button"
              className={smallButtonClassName}
              disabled={controlsDisabled}
              onClick={onReplace}
              aria-label={`Replace photo ${index + 1}`}
            >
              Replace
            </button>
            <button
              type="button"
              className={smallButtonClassName}
              disabled={controlsDisabled}
              onClick={onRemove}
              aria-label={`Remove photo ${index + 1}`}
            >
              Remove
            </button>
          </div>
        </>
      ) : null}

      {item.error ? (
        <p role="alert" className={fieldErrorClassName}>
          {item.error}
        </p>
      ) : null}
    </li>
  );
}

// For customers who can't provide a usable photo. The business sees the
// request flagged as having limited visual information.
function DescriptionFallback({
  mode,
  businessName,
  initialDescription,
  hasPhotos,
  canContinue,
}: {
  mode: PhotoIntakeMode;
  businessName: string;
  initialDescription: string;
  hasPhotos: boolean;
  canContinue: boolean;
}) {
  const [open, setOpen] = useState(initialDescription !== "");
  const [description, setDescription] = useState(initialDescription);
  const [saved, setSaved] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result =
      mode.kind === "live"
        ? await saveIntakeDescriptionAction(mode.token, description)
        : description.trim()
          ? { ok: true as const }
          : { ok: false as const, error: "Describe the problem in a few words." };
    setSaving(false);
    if (result.ok) {
      setSaved(description.trim());
      setDescription(description.trim());
    } else {
      setError(result.error);
    }
  }

  const ready = canContinue || (!hasPhotos && saved !== "");

  return (
    <>
      {!open && !hasPhotos ? (
        <button
          type="button"
          className="self-start text-sm text-neutral-700 underline"
          onClick={() => setOpen(true)}
        >
          Can&apos;t take a photo?
        </button>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="intake-description" className="text-sm font-medium">
            Describe the problem instead
          </label>
          <p className="text-sm text-neutral-600">
            {businessName} will see that no photo was available. You can still
            add one later.
          </p>
          <textarea
            id="intake-description"
            rows={4}
            value={description}
            maxLength={INTAKE_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "intake-description-error" : undefined}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-base focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={smallButtonClassName}
              disabled={saving || description.trim() === saved}
              onClick={save}
            >
              {saving ? "Saving…" : "Save description"}
            </button>
            <p className="text-xs text-neutral-500" aria-live="polite">
              {saved !== "" && description.trim() === saved ? "Saved" : ""}
            </p>
          </div>
          {error ? (
            <p id="intake-description-error" role="alert" className={fieldErrorClassName}>
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {ready ? (
        <div className="flex flex-col gap-2 border-t border-neutral-200 pt-6">
          <button type="button" disabled className={primaryClassName}>
            Continue
          </button>
          <p className="text-sm text-neutral-500">
            Your {hasPhotos ? "photos are" : "description is"} saved. Next
            you&apos;ll answer a few short questions; that step is coming soon.
          </p>
        </div>
      ) : null}
    </>
  );
}

// XMLHttpRequest rather than fetch, which can't report upload progress.
function uploadPhoto(
  token: string,
  file: File,
  replacing: SavedPhoto | null,
  onProgress: (progress: number) => void,
): Promise<UploadResult> {
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
      resolve(
        xhr.status === 200 && body?.photo
          ? { ok: true, photo: body.photo }
          : { ok: false, error: body?.error ?? UPLOAD_FAILED },
      );
    };
    xhr.onerror = () => resolve({ ok: false, error: UPLOAD_FAILED });

    const form = new FormData();
    form.append("photo", file);
    if (replacing) {
      form.append("replaces", replacing.id);
      form.append("caption", replacing.caption);
    }
    xhr.send(form);
  });
}

function simulateUpload(
  replacing: SavedPhoto | null,
  onProgress: (progress: number) => void,
  newId: () => string,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + 0.25, 1);
      onProgress(progress);
      if (progress === 1) {
        clearInterval(timer);
        resolve({
          ok: true,
          photo: {
            id: newId(),
            thumbnailUrl: "",
            caption: replacing?.caption ?? "",
            rotation: 0,
          },
        });
      }
    }, 150);
  });
}
