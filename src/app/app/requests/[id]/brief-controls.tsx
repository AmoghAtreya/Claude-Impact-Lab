"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { secondaryButtonClassName } from "@/app/ui/form-styles";
import { retryBriefAction } from "../actions";

// Re-fetches the page while the brief is being written so it appears
// without a manual refresh.
export function BriefAutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}

export function RetryBriefButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await retryBriefAction(requestId);
            if (result.error) setError(result.error);
          })
        }
        className={`${secondaryButtonClassName} self-start`}
      >
        {pending ? "Starting…" : "Try again"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
