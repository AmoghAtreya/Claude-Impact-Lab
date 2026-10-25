"use server";

import { isIntakeToken } from "@/lib/intake-links";
import {
  removeIntakePhoto,
  rotateIntakePhoto,
  saveIntakeDescription,
  setIntakePhotoCaption,
  type IntakeResult,
} from "@/lib/intake-photos";

// Customer photo edits. Customers aren't signed in: every call is
// authorized by the link token, which the database functions check (active,
// unexpired, not submitted) before changing anything. Uploads go through
// ./photos/route.ts instead so the browser can show progress.

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const invalid = { ok: false as const, error: "Something went wrong. Please refresh the page." };

function validIds(token: unknown, photoId?: unknown) {
  return (
    typeof token === "string" &&
    isIntakeToken(token) &&
    (photoId === undefined || (typeof photoId === "string" && UUID_PATTERN.test(photoId)))
  );
}

export async function removePhotoAction(token: string, photoId: string): Promise<IntakeResult> {
  if (!validIds(token, photoId)) return invalid;
  return removeIntakePhoto(token, photoId);
}

export async function rotatePhotoAction(
  token: string,
  photoId: string,
): Promise<IntakeResult<{ thumbnailUrl: string }>> {
  if (!validIds(token, photoId)) return invalid;
  return rotateIntakePhoto(token, photoId);
}

export async function captionPhotoAction(
  token: string,
  photoId: string,
  caption: string,
): Promise<IntakeResult> {
  if (!validIds(token, photoId) || typeof caption !== "string") return invalid;
  return setIntakePhotoCaption(token, photoId, caption);
}

export async function saveDescriptionAction(token: string, description: string): Promise<IntakeResult> {
  if (!validIds(token) || typeof description !== "string") return invalid;
  return saveIntakeDescription(token, description);
}
