"use server";

import { z } from "zod";
import { isIntakeToken } from "@/lib/intake-links";
import {
  INTAKE_CAPTION_MAX_LENGTH,
  INTAKE_DESCRIPTION_MAX_LENGTH,
  INTAKE_PHOTO_ROTATIONS,
} from "@/lib/intake-photo-rules";
import {
  removeIntakePhoto,
  saveIntakeDescription,
  updateIntakePhoto,
  type IntakeResult,
} from "@/lib/intake-photos";

// Customers aren't signed in. Holding the link token is the authorization;
// the database functions check it on every call.

const tokenSchema = z.string().refine(isIntakeToken);
const photoIdSchema = z.uuid();
const INVALID: IntakeResult = {
  ok: false,
  error: "Something went wrong. Please refresh the page and try again.",
};

export async function removeIntakePhotoAction(
  token: string,
  photoId: string,
): Promise<IntakeResult> {
  if (!tokenSchema.safeParse(token).success || !photoIdSchema.safeParse(photoId).success) {
    return INVALID;
  }
  return removeIntakePhoto(token, photoId);
}

const photoChangesSchema = z.object({
  caption: z.string().max(INTAKE_CAPTION_MAX_LENGTH),
  rotation: z.literal(INTAKE_PHOTO_ROTATIONS),
});

export async function updateIntakePhotoAction(
  token: string,
  photoId: string,
  changes: z.input<typeof photoChangesSchema>,
): Promise<IntakeResult> {
  const parsed = photoChangesSchema.safeParse(changes);
  if (
    !tokenSchema.safeParse(token).success ||
    !photoIdSchema.safeParse(photoId).success ||
    !parsed.success
  ) {
    return INVALID;
  }
  return updateIntakePhoto(token, photoId, parsed.data);
}

const descriptionSchema = z
  .string()
  .trim()
  .min(1, { error: "Describe the problem in a few words." })
  .max(INTAKE_DESCRIPTION_MAX_LENGTH, {
    error: "Keep the description under 2,000 characters.",
  });

export async function saveIntakeDescriptionAction(
  token: string,
  description: string,
): Promise<IntakeResult> {
  if (!tokenSchema.safeParse(token).success) {
    return INVALID;
  }
  const parsed = descriptionSchema.safeParse(description);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  return saveIntakeDescription(token, parsed.data);
}
