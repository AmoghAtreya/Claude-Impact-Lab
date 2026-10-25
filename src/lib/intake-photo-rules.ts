// Shared by the intake page (early feedback) and the server (enforced).
// The photo count is also enforced by reserve_intake_photo.
export const INTAKE_PHOTO_MAX_COUNT = 5;
export const INTAKE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const INTAKE_CAPTION_MAX_LENGTH = 300;
export const INTAKE_DESCRIPTION_MAX_LENGTH = 2000;

// iOS converts HEIC photos to JPEG when the picker only accepts these types.
export const INTAKE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const INTAKE_PHOTO_ACCEPTED_TYPES = INTAKE_PHOTO_ACCEPT.split(",");

export const INTAKE_PHOTO_ROTATIONS = [0, 90, 180, 270] as const;
export type IntakePhotoRotation = (typeof INTAKE_PHOTO_ROTATIONS)[number];

// What the customer's browser knows about a saved photo.
export type IntakePhoto = {
  id: string;
  thumbnailUrl: string;
  caption: string;
  rotation: IntakePhotoRotation;
};
