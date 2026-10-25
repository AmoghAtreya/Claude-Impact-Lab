"use client";

import { useState, useTransition } from "react";
import { fieldErrorClassName, inputClassName } from "@/app/ui/form-styles";
import { deleteServiceRequest, setRequestArchived } from "../actions";

const secondaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium disabled:opacity-60";

export function ManageRequestPanel({
  requestId,
  requestNumber,
  archived,
  canDelete,
  photoCount,
  hasActiveLink,
}: {
  requestId: string;
  requestNumber: number;
  archived: boolean;
  canDelete: boolean;
  photoCount: number;
  hasActiveLink: boolean;
}) {
  const [archiving, startArchive] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleArchived() {
    setError(null);
    startArchive(async () => {
      const result = await setRequestArchived(requestId, !archived);
      if (result.error) setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startDelete(async () => {
      // Redirects to the request list on success.
      const result = await deleteServiceRequest(requestId, confirmation);
      if (result?.error) setError(result.error);
    });
  }

  const confirmed = confirmation.trim().replace(/^#/, "") === String(requestNumber);

  return (
    <section
      aria-labelledby="manage-request-heading"
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6"
    >
      <h2 id="manage-request-heading" className="text-base font-semibold">
        Manage request
      </h2>

      <div className="flex flex-col gap-2">
        <p className="text-sm leading-6 text-neutral-700">
          {archived
            ? "This request is archived. Restore it to show it in your request list again."
            : "Archive requests you're done with to hide them from your request list. Nothing is deleted, and you can restore it anytime."}
        </p>
        <div>
          <button
            type="button"
            onClick={toggleArchived}
            disabled={archiving || deleting}
            className={secondaryButtonClassName}
          >
            {archiving
              ? archived
                ? "Restoring…"
                : "Archiving…"
              : archived
                ? "Restore request"
                : "Archive request"}
          </button>
        </div>
      </div>

      {canDelete ? (
        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
          {!confirmOpen ? (
            <div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="text-sm text-red-700 underline"
              >
                Delete request permanently…
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">
                Permanently delete request #{requestNumber}?
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-red-900">
                <li>The customer&apos;s details and answers are deleted.</li>
                <li>
                  {photoCount === 0
                    ? "There are no photos to delete."
                    : `All ${photoCount} ${photoCount === 1 ? "photo is" : "photos are"} deleted from storage.`}
                </li>
                <li>
                  {hasActiveLink
                    ? "The customer's intake link stops working."
                    : "Its intake links are deleted."}
                </li>
                <li>This can&apos;t be undone. To keep a record, archive it instead.</li>
              </ul>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="delete-confirmation" className="text-sm font-medium text-red-900">
                  Type {requestNumber} to confirm
                </label>
                <input
                  id="delete-confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${inputClassName} w-32`}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={remove}
                  disabled={!confirmed || deleting}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmation("");
                    setError(null);
                  }}
                  disabled={deleting}
                  className={secondaryButtonClassName}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={fieldErrorClassName}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
