// Shared by the intake wizard (early feedback) and the server (enforced).
// The photo count is also enforced by reserve_intake_photo.
export const INTAKE_PHOTO_MAX_COUNT = 5;
export const INTAKE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// Guided photo prompt ids, e.g. "outdoor-unit". Matches the database check.
export const PROMPT_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

// What the customer's browser knows about a saved photo.
export type IntakePhoto = {
  id: string;
  promptId: string | null;
  thumbnailUrl: string;
};
